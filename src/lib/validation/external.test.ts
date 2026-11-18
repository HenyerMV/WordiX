import assert from "node:assert/strict";
import { test } from "node:test";
import { checkWiktionary, resultKey, validateBatch, validateExternal, type FetchLike } from "./external.ts";

/** fetch falso: responde según el host y registra las llamadas. */
function fakeFetch(handlers: { search?: unknown; ask?: unknown; wikt?: unknown; fail?: boolean }) {
  const calls: string[] = [];
  const fn: FetchLike = async (url) => {
    calls.push(url);
    if (handlers.fail) throw new Error("sin red");
    const body = url.includes("wbsearchentities")
      ? handlers.search
      : url.includes("query.wikidata.org")
        ? handlers.ask
        : handlers.wikt;
    return { ok: true, json: async () => body };
  };
  return { fn, calls };
}

test("Wikidata acepta una palabra que está dentro de la clase", async () => {
  const { fn, calls } = fakeFetch({
    search: { search: [{ id: "Q144", label: "perro", match: { text: "perro" } }] },
    ask: { boolean: true },
  });
  const r = await validateExternal({ slug: "animal", answer: "perro" }, fn);
  assert.deepEqual(r, { status: "accepted", source: "wikidata" });
  assert.equal(calls.length, 2);
  assert.match(calls[1], /ASK/);
});

test("ignora candidatos que no coinciden exactamente con la palabra", async () => {
  const { fn, calls } = fakeFetch({
    search: { search: [{ id: "Q1", label: "perrito caliente", match: { text: "perrito caliente" } }] },
    ask: { boolean: true },
    wikt: { query: { pages: { "-1": { missing: "" } } } },
  });
  const r = await validateExternal({ slug: "animal", answer: "perro" }, fn);
  assert.deepEqual(r, { status: "in_review" });
  assert.ok(!calls.some((c) => c.includes("query.wikidata.org")), "no debe consultar SPARQL sin candidatos");
});

test("la coincidencia ignora tildes y mayúsculas", async () => {
  const { fn } = fakeFetch({
    search: { search: [{ id: "Q1", label: "León", match: { text: "León" } }] },
    ask: { boolean: true },
  });
  const r = await validateExternal({ slug: "animal", answer: "leon" }, fn);
  assert.equal(r.status, "accepted");
});

test("si Wikidata no confirma pero el Wikcionario sí, se acepta con ese origen", async () => {
  const { fn } = fakeFetch({
    search: { search: [] },
    wikt: { query: { pages: { "123": { categories: [{ title: "Categoría:ES:Frutas" }] } } } },
  });
  const r = await validateExternal({ slug: "fruta", answer: "mango" }, fn);
  assert.deepEqual(r, { status: "accepted", source: "wiktionary" });
});

test("una entrada del Wikcionario que no existe no confirma nada", async () => {
  const { fn } = fakeFetch({ wikt: { query: { pages: { "-1": { missing: "" } } } } });
  assert.equal(await checkWiktionary("zzz", [/frutas/i], fn), false);
});

test("si las fuentes fallan, va a revisión grupal y no lanza error", async () => {
  const { fn } = fakeFetch({ fail: true });
  const r = await validateExternal({ slug: "animal", answer: "perro" }, fn);
  assert.deepEqual(r, { status: "in_review" });
});

test("una categoría desconocida va a revisión grupal", async () => {
  const { fn, calls } = fakeFetch({});
  const r = await validateExternal({ slug: "inventada", answer: "perro" }, fn);
  assert.deepEqual(r, { status: "in_review" });
  assert.equal(calls.length, 0);
});

test("el lote consulta una sola vez las palabras repetidas", async () => {
  const { fn, calls } = fakeFetch({
    search: { search: [{ id: "Q144", label: "perro", match: { text: "perro" } }] },
    ask: { boolean: true },
  });
  const results = await validateBatch(
    [
      { slug: "animal", answer: "perro" },
      { slug: "animal", answer: "perro" },
    ],
    fn,
  );
  assert.equal(results.size, 1);
  assert.equal(results.get(resultKey("animal", "perro"))?.status, "accepted");
  assert.equal(calls.length, 2);
});

test("pasado el límite de tiempo, todo va a revisión sin consultar", async () => {
  const { fn, calls } = fakeFetch({ search: { search: [] } });
  const results = await validateBatch([{ slug: "animal", answer: "perro" }], fn, { deadline: Date.now() - 1 });
  assert.equal(results.get(resultKey("animal", "perro"))?.status, "in_review");
  assert.equal(calls.length, 0);
});
