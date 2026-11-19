import assert from "node:assert/strict";
import { test } from "node:test";
import { POINTS_SHARED, POINTS_UNIQUE, rankPlayers, scoreRound } from "./scoring.ts";

const ok = (player_id: string, category_id: number, answer: string) => ({ player_id, category_id, answer, status: "accepted" });
const bad = (player_id: string, category_id: number, answer: string) => ({ player_id, category_id, answer, status: "rejected" });

test("una palabra válida única vale 100", () => {
  const p = scoreRound([ok("a", 1, "perro"), ok("b", 1, "gato")]);
  assert.equal(p.get("a|1"), POINTS_UNIQUE);
  assert.equal(p.get("b|1"), POINTS_UNIQUE);
});

test("la misma palabra válida entre dos jugadores vale 50 a cada uno", () => {
  const p = scoreRound([ok("a", 1, "perro"), ok("b", 1, "perro")]);
  assert.equal(p.get("a|1"), POINTS_SHARED);
  assert.equal(p.get("b|1"), POINTS_SHARED);
});

test("con tres jugadores, los dos que repiten ganan 50 y el distinto 100", () => {
  const p = scoreRound([ok("a", 1, "perro"), ok("b", 1, "perro"), ok("c", 1, "gato")]);
  assert.equal(p.get("a|1"), 50);
  assert.equal(p.get("b|1"), 50);
  assert.equal(p.get("c|1"), 100);
});

test("repetir la palabra no depende de tildes ni mayúsculas", () => {
  const p = scoreRound([ok("a", 1, "técnico"), ok("b", 1, "tecnico")]);
  assert.equal(p.get("a|1"), 50);
  assert.equal(p.get("b|1"), 50);
});

test("la misma palabra en categorías distintas no cuenta como repetida", () => {
  const p = scoreRound([ok("a", 1, "marco"), ok("b", 2, "marco")]);
  assert.equal(p.get("a|1"), 100);
  assert.equal(p.get("b|2"), 100);
});

test("una respuesta rechazada vale 0 y no hace que la otra se considere repetida", () => {
  const p = scoreRound([bad("a", 1, "perro"), ok("b", 1, "perro")]);
  assert.equal(p.get("a|1"), 0);
  assert.equal(p.get("b|1"), 100);
});

test("el único jugador con respuesta válida en una categoría gana 100", () => {
  const p = scoreRound([ok("a", 1, "perro")]);
  assert.equal(p.get("a|1"), 100);
});

test("la clasificación ordena por puntos y los empates comparten posición", () => {
  const r = rankPlayers([
    { player_id: "a", total_points: 300 },
    { player_id: "b", total_points: 500 },
    { player_id: "c", total_points: 300 },
    { player_id: "d", total_points: 100 },
  ]);
  assert.deepEqual(
    r.map((x) => [x.player_id, x.position]),
    [
      ["b", 1],
      ["a", 2],
      ["c", 2],
      ["d", 4],
    ],
  );
});
