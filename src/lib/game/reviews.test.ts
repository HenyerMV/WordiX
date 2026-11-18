import assert from "node:assert/strict";
import { test } from "node:test";
import { decideReview, tallyReview } from "./reviews.ts";

const yes = (id: string) => ({ voter_id: id, approve: true });
const no = (id: string) => ({ voter_id: id, approve: false });

test("sin votos, la revisión sigue abierta", () => {
  assert.equal(decideReview([], ["b", "c"]), "open");
});

test("todos a favor la aceptan", () => {
  assert.equal(decideReview([yes("b"), yes("c")], ["b", "c"]), "accepted");
});

test("faltan votos a favor: sigue abierta", () => {
  assert.equal(decideReview([yes("b")], ["b", "c"]), "open");
});

test("un solo voto en contra la rechaza, aunque falten votos", () => {
  assert.equal(decideReview([no("b")], ["b", "c", "d"]), "rejected");
  assert.equal(decideReview([yes("b"), yes("c"), no("d")], ["b", "c", "d"]), "rejected");
});

test("con dos jugadores decide el único voto del otro jugador", () => {
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
