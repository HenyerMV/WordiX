import assert from "node:assert/strict";
import { test } from "node:test";
import {
  finalizeInput,
  isValidFormat,
  isValidRoomCode,
  normalizeForSearch,
  sanitizeCode,
  sanitizeInput,
  startsWithLetter,
  validateName,
} from "./text.ts";

test("sanitizeInput pasa a minúsculas y quita números y símbolos", () => {
  assert.equal(sanitizeInput("Hola Mundo 123!"), "hola mundo ");
  assert.equal(sanitizeInput("MESA#1"), "mesa");
});

test("sanitizeInput conserva ñ, tildes y ü", () => {
  assert.equal(sanitizeInput("ÑANDÚ"), "ñandú");
  assert.equal(sanitizeInput("Pingüino"), "pingüino");
});

test("sanitizeInput une tildes descompuestas (teclados móviles)", () => {
  assert.equal(sanitizeInput("león"), "león");
});

test("sanitizeInput colapsa espacios y quita el inicial", () => {
  assert.equal(sanitizeInput("  rio   de   janeiro"), "rio de janeiro");
});

test("sanitizeInput respeta la longitud máxima", () => {
  assert.equal(sanitizeInput("abcdefghij", 4), "abcd");
});

test("finalizeInput quita espacios finales", () => {
  assert.equal(finalizeInput("hola "), "hola");
});

test("isValidFormat acepta palabras válidas", () => {
  assert.equal(isValidFormat("ñandú"), true);
  assert.equal(isValidFormat("río de janeiro"), true);
});

test("isValidFormat rechaza vacío, números, símbolos y espacios mal puestos", () => {
  assert.equal(isValidFormat(""), false);
  assert.equal(isValidFormat("hola1"), false);
  assert.equal(isValidFormat("spider-man"), false);
  assert.equal(isValidFormat("hola  mundo"), false);
  assert.equal(isValidFormat(" hola"), false);
  assert.equal(isValidFormat("hola "), false);
  assert.equal(isValidFormat("Hola"), false);
});

test("normalizeForSearch quita tildes pero conserva la ñ", () => {
  assert.equal(normalizeForSearch("León"), "leon");
  assert.equal(normalizeForSearch("pingüino"), "pinguino");
  assert.equal(normalizeForSearch("ñu"), "ñu");
});

test("startsWithLetter ignora tildes y distingue ñ de n", () => {
  assert.equal(startsWithLetter("árbol", "a"), true);
  assert.equal(startsWithLetter("ñandú", "n"), false);
  assert.equal(startsWithLetter("ñandú", "ñ"), true);
  assert.equal(startsWithLetter("perro", "p"), true);
  assert.equal(startsWithLetter("perro", "pe"), false);
});

test("validateName acepta nombres válidos y los limpia", () => {
  assert.deepEqual(validateName("Juan Pérez"), { ok: true, value: "juan pérez" });
  assert.deepEqual(validateName("juan1"), { ok: true, value: "juan" });
});

test("validateName rechaza nombres cortos o largos", () => {
  assert.equal(validateName("a").ok, false);
  assert.equal(validateName("123").ok, false);
  assert.equal(validateName("abcdefghijklmnopq").ok, false);
});

test("sanitizeCode deja solo seis dígitos", () => {
  assert.equal(sanitizeCode("12-34 56789"), "123456");
  assert.equal(sanitizeCode("abc"), "");
});

test("isValidRoomCode exige exactamente seis dígitos", () => {
  assert.equal(isValidRoomCode("123456"), true);
  assert.equal(isValidRoomCode("12345"), false);
  assert.equal(isValidRoomCode("1234567"), false);
  assert.equal(isValidRoomCode("12345a"), false);
});
