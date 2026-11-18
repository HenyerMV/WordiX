// Validación con fuentes externas (Wikidata y Wikcionario). Solo se usa en el servidor.
// Las funciones reciben `fetch` como parámetro para poder probarlas sin red.

import { normalizeForSearch } from "../game/text.ts";
import { CATEGORY_RULES } from "./config.ts";

export type FetchLike = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

export type ExternalSource = "wikidata" | "wiktionary";

export type ExternalResult =
  | { status: "accepted"; source: ExternalSource }
  | { status: "in_review" };

export interface ExternalItem {
  /** Clave de la categoría (categories.slug). */
  slug: string;
  /** Palabra tal como la escribió el jugador (ya validada en formato y letra). */
  answer: string;
}

const USER_AGENT = "WordiX/0.1 (https://github.com/HenyerMV/WordiX; validacion de palabras)";
const REQUEST_TIMEOUT_MS = 6000;

async function getJson(fetchFn: FetchLike, url: string, accept: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetchFn(url, {
      headers: { "User-Agent": USER_AGENT, Accept: accept },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("HTTP_ERROR");
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** ¿Hay en Wikidata algo llamado así (en español) que esté dentro de alguna de las clases? */
export async function checkWikidata(word: string, classes: string[], fetchFn: FetchLike): Promise<boolean> {
  const target = normalizeForSearch(word);

  const searchUrl =
    "https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&type=item&limit=8" +
    `&language=es&uselang=es&search=${encodeURIComponent(word)}`;
  const found = (await getJson(fetchFn, searchUrl, "application/json")) as {
    search?: { id?: string; label?: string; match?: { text?: string } }[];
  };

  // Solo candidatos cuyo nombre o alias coincide exactamente (sin tildes ni mayúsculas).
  const ids = (found.search ?? [])
    .filter((hit) => {
      const text = hit.match?.text ?? hit.label ?? "";
      return typeof hit.id === "string" && /^Q\d+$/.test(hit.id) && normalizeForSearch(text) === target;
    })
    .map((hit) => hit.id as string);
  if (ids.length === 0) return false;

  // "+" (y no "*") para exigir que esté POR DEBAJO de la clase, no que sea la clase misma.
  const query =
    `ASK { VALUES ?item { ${ids.map((id) => `wd:${id}`).join(" ")} } ` +
    `VALUES ?class { ${classes.map((id) => `wd:${id}`).join(" ")} } ` +
    "?item (wdt:P31|wdt:P279|wdt:P171)+ ?class }";
  const sparqlUrl = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const answer = (await getJson(fetchFn, sparqlUrl, "application/sparql-results+json")) as { boolean?: boolean };
  return answer.boolean === true;
}

/** ¿Existe la entrada en es.wiktionary.org y está en una categoría que corresponde? */
export async function checkWiktionary(word: string, patterns: RegExp[], fetchFn: FetchLike): Promise<boolean> {
  const url =
    "https://es.wiktionary.org/w/api.php?action=query&format=json&redirects=1&prop=categories&cllimit=max" +
    `&titles=${encodeURIComponent(word)}`;
  const data = (await getJson(fetchFn, url, "application/json")) as {
    query?: { pages?: Record<string, { missing?: unknown; categories?: { title?: string }[] }> };
  };
  const pages = Object.values(data.query?.pages ?? {});
  return pages.some(
    (page) =>
      page.missing === undefined &&
      (page.categories ?? []).some((c) => patterns.some((re) => re.test(c.title ?? ""))),
  );
}

/** Valida una palabra con las fuentes de su categoría. Nunca lanza: ante dudas, revisión grupal. */
export async function validateExternal(item: ExternalItem, fetchFn: FetchLike): Promise<ExternalResult> {
  const rule = CATEGORY_RULES[item.slug];
  if (!rule) return { status: "in_review" };

  if (rule.wikidata?.length) {
    try {
      if (await checkWikidata(item.answer, rule.wikidata, fetchFn)) return { status: "accepted", source: "wikidata" };
    } catch (e) {
      console.error("[wordix] Wikidata falló", item.slug, e);
    }
  }
  if (rule.wiktionary?.length) {
    try {
      if (await checkWiktionary(item.answer, rule.wiktionary, fetchFn)) return { status: "accepted", source: "wiktionary" };
    } catch (e) {
      console.error("[wordix] Wikcionario falló", item.slug, e);
    }
  }
  return { status: "in_review" };
}

export interface BatchOptions {
  concurrency?: number;
  /** Momento (Date.now()) a partir del cual ya no se consulta y todo pasa a revisión. */
  deadline?: number;
}

/**
 * Valida varias palabras. Las repetidas (misma categoría y misma palabra) se consultan una vez.
 * Devuelve un mapa con clave `${slug}|${palabra normalizada}`.
 */
export async function validateBatch(
  items: ExternalItem[],
  fetchFn: FetchLike,
  options: BatchOptions = {},
): Promise<Map<string, ExternalResult>> {
  const concurrency = options.concurrency ?? 6;
  const deadline = options.deadline ?? Number.POSITIVE_INFINITY;

  const unique = new Map<string, ExternalItem>();
  for (const item of items) {
    const key = resultKey(item.slug, item.answer);
    if (!unique.has(key)) unique.set(key, item);
  }

  const queue = [...unique.entries()];
  const results = new Map<string, ExternalResult>();

  async function worker() {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      const [key, item] = next;
      results.set(key, Date.now() > deadline ? { status: "in_review" } : await validateExternal(item, fetchFn));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  return results;
}

export function resultKey(slug: string, answer: string): string {
  return `${slug}|${normalizeForSearch(answer)}`;
}
