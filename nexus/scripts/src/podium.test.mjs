import assert from "node:assert/strict";
import { test } from "node:test";
import {
  awards,
  canCelebrate,
  timeline,
  revealedRanks,
  resultVersion,
  seenKey,
} from "../../apps/web/src/features/podium/model.ts";
const row = (id, position, score) => ({
  id,
  name: id,
  position,
  score,
  expected: 2,
  submitted: 2,
});
const result = {
  event_id: "event",
  name: "Published result",
  status: "closed",
  published: true,
  rows: [
    row("first", 1, 4.8),
    row("second", 2, 4.4),
    row("third", 3, 4),
    row("fourth", 4, 3),
  ],
};
test("ceremony requires final, published, complete ranked results", () => {
  assert.equal(canCelebrate(result), true);
  for (const candidate of [
    { ...result, published: false },
    { ...result, status: "open" },
    { ...result, status: "cancelled" },
    { ...result, rows: [] },
    { ...result, rows: [{ ...result.rows[0], submitted: 1 }] },
    { ...result, rows: [{ ...result.rows[0], score: null }] },
    { ...result, rows: [{ ...result.rows[0], position: null }] },
  ])
    assert.equal(canCelebrate(candidate), false);
});
test("reveal is third, second, suspense, first and finale, without invented ranks", () => {
  const phases = timeline(result);
  assert.deepEqual(
    phases.filter((p) => p.rank).map((p) => p.rank),
    [3, 2, 1],
  );
  const suspense = phases.find((p) => p.kind === "suspense");
  assert.deepEqual(revealedRanks(phases, suspense.start), [3, 2]);
  assert.deepEqual(revealedRanks(phases, 0), []);
  assert.ok(phases.at(-1).end >= 20000 && phases.at(-1).end <= 30000);
  assert.deepEqual(
    timeline({ ...result, rows: [result.rows[0]] })
      .filter((p) => p.rank)
      .map((p) => p.rank),
    [1],
  );
});
test("all tied winners share a reveal and the database positions are retained", () => {
  const tied = {
    ...result,
    rows: [
      row("one", 1, 4.8),
      row("two", 1, 4.8),
      row("three", 2, 4.4),
      row("four", 3, 4),
    ],
  };
  assert.equal(awards(tied)[0].projects.length, 2);
  assert.equal(timeline(tied).filter((p) => p.rank === 1).length, 1);
  assert.deepEqual(
    awards(tied).map((group) => group.rank),
    [1, 2, 3],
  );
});
test("seen marker is account/institution/event specific and changes with a new result", () => {
  assert.notEqual(seenKey("a", "i", "event"), seenKey("b", "i", "event"));
  assert.notEqual(seenKey("a", "i", "event"), seenKey("a", "other", "event"));
  assert.equal(
    resultVersion(result),
    resultVersion({ ...result, rows: result.rows.slice().reverse() }),
  );
  assert.notEqual(
    resultVersion(result),
    resultVersion({
      ...result,
      rows: [{ ...result.rows[0], score: 5 }, ...result.rows.slice(1)],
    }),
  );
});
