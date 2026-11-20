import assert from "node:assert/strict";
import { test } from "node:test";
import { decideReview, tallyReview } from "./reviews.ts";

const yes = (id: string) => ({ voter_id: id, approve: true });
const no = (id: string) => ({ voter_id: id, approve: false });

test("sin votos, la revisión sigue abierta", () => {
  assert.equal(decideReview([], ["b", "c"]), "open");
});

test("con tres votantes, 2 a favor y 1 en contra la aceptan (caso bogotá)", () => {
  assert.equal(decideReview([yes("b"), yes("c"), no("d")], ["b", "c", "d"]), "accepted");
});

test("con tres votantes, se acepta en cuanto hay 2 a favor, sin esperar al tercero", () => {
  assert.equal(decideReview([yes("b"), yes("c")], ["b", "c", "d"]), "accepted");
});

test("con tres votantes, un solo voto en contra ya no la rechaza", () => {
  assert.equal(decideReview([no("b")], ["b", "c", "d"]), "open");
  assert.equal(decideReview([yes("b"), no("c")], ["b", "c", "d"]), "open");
});

test("con tres votantes, 2 en contra la rechazan", () => {
  assert.equal(decideReview([no("b"), no("c")], ["b", "c", "d"]), "rejected");
  assert.equal(decideReview([yes("b"), no("c"), no("d")], ["b", "c", "d"]), "rejected");
});

test("con dos votantes, un empate rechaza y hace falta que ambos digan sí", () => {
  assert.equal(decideReview([yes("b"), no("c")], ["b", "c"]), "rejected");
  assert.equal(decideReview([no("b")], ["b", "c"]), "rejected");
  assert.equal(decideReview([yes("b")], ["b", "c"]), "open");
  assert.equal(decideReview([yes("b"), yes("c")], ["b", "c"]), "accepted");
});

test("con un solo votante decide su voto", () => {
  assert.equal(decideReview([yes("b")], ["b"]), "accepted");
  assert.equal(decideReview([no("b")], ["b"]), "rejected");
});

test("los votos de quien no debe votar (por ejemplo el autor) no cuentan", () => {
  assert.equal(decideReview([no("a")], ["b"]), "open");
  assert.equal(decideReview([yes("a"), yes("b")], ["b"]), "accepted");
});

test("sin jugadores que voten nunca se acepta sola", () => {
  assert.equal(decideReview([], []), "open");
});

test("el autor no puede votar su propia palabra", () => {
  const t = tallyReview([], "a", ["a", "b", "c"], "a");
  assert.equal(t.canVote, false);
  assert.equal(t.total, 2);
});

test("un jugador que ya votó no puede votar otra vez y ve su voto", () => {
  const t = tallyReview([yes("b")], "a", ["a", "b", "c"], "b");
  assert.equal(t.canVote, false);
  assert.equal(t.myVote, true);
  assert.equal(t.voted, 1);
  assert.equal(t.decision, "open");
});

test("un jugador que no ha votado sí puede", () => {
  const t = tallyReview([yes("b")], "a", ["a", "b", "c"], "c");
  assert.equal(t.canVote, true);
  assert.equal(t.myVote, null);
});
