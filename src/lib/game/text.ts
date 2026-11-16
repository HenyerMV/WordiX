// Reglas de texto de WordiX. Módulo sin dependencias: se usa en el navegador
// y se puede probar con `npm test`. Debe mantenerse alineado con el SQL:
//  - wordix_normalize()   (supabase/migrations/..._diccionario.sql)
//  - restricciones de formato de players, game_answers y word_dictionary

export const NAME_MIN = 2;
export const NAME_MAX = 16;
export const ROOM_CODE_LENGTH = 6;

const INVALID_CHARS = /[^a-záéíóúüñ ]/g;
const FORMAT = /^[a-záéíóúüñ]+( [a-záéíóúüñ]+)*$/;

const ACCENT_MAP: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ü: "u",
};

/**
 * Limpia lo que escribe el jugador mientras teclea: pasa a minúsculas y quita
 * números, símbolos y espacios repetidos. Conserva ñ, vocales acentuadas y ü.
 * Deja un espacio final para poder escribir palabras compuestas.
 */
export function sanitizeInput(raw: string, maxLength?: number): string {
  let value = raw
    .normalize("NFC")
    .toLowerCase()
    .replace(INVALID_CHARS, "")
    .replace(/ {2,}/g, " ")
    .replace(/^ /, "");
  if (maxLength !== undefined) value = value.slice(0, maxLength);
  return value;
}

/** Versión final de una respuesta: limpia y sin espacios en los extremos. */
export function finalizeInput(raw: string): string {
  return sanitizeInput(raw).trim();
}

/** Solo letras del español en minúsculas, con espacios simples entre palabras. */
export function isValidFormat(value: string): boolean {
  return FORMAT.test(value);
}

/**
 * Forma para comparar y buscar: minúsculas y sin tildes. La ñ se conserva
 * porque es otra letra. La palabra original se guarda siempre aparte.
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/[áéíóúü]/g, (c) => ACCENT_MAP[c] ?? c);
}

/** ¿La palabra empieza por la letra de la ruleta? (ignora tildes, no la ñ). */
export function startsWithLetter(word: string, letter: string): boolean {
  const w = normalizeForSearch(word);
  const l = normalizeForSearch(letter);
  return l.length === 1 && w.startsWith(l);
}

export type NameCheck = { ok: true; value: string } | { ok: false; error: string };

export function validateName(raw: string): NameCheck {
  const value = finalizeInput(raw);
  if (value.length < NAME_MIN) {
    return { ok: false, error: `Escribe al menos ${NAME_MIN} letras.` };
  }
  if (value.length > NAME_MAX) {
    return { ok: false, error: `Máximo ${NAME_MAX} caracteres.` };
  }
  if (!isValidFormat(value)) {
    return { ok: false, error: "Usa solo letras minúsculas, sin números ni símbolos." };
  }
  return { ok: true, value };
}

/** Deja solo dígitos, hasta 6. */
export function sanitizeCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  return /^[0-9]{6}$/.test(code);
}
