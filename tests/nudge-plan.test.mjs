import assert from "node:assert/strict";
import test from "node:test";
import { answerRates, closureProbability, rank } from "../src/nudge-plan.mjs";

test("answer rates are Beta posterior means, ignoring nudges still inside the window", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");
  const nudges = [
    { at: "2026-11-20T09:00:00Z", slug: "a", thread: "t1" },
    { at: "2026-11-20T09:10:00Z", slug: "a", thread: "t2" },
    { at: "2026-11-20T11:55:00Z", slug: "a", thread: "t3" },
  ];
  const rate = answerRates(nudges, (slug, thread) => thread === "t1" ? [Date.parse("2026-11-20T09:05:00Z")] : [], now);
  assert.equal(rate("a"), 2 / 4);
  assert.equal(rate("nobody"), 0.5);
});

test("the thread closest to closing ranks first for an agent", () => {
  const rate = slug => ({ a: 0.8, b: 0.2 }[slug]);
  const ranked = rank("a", [{ id: "needs-b", missing: ["a", "b"] }, { id: "only-a", missing: ["a"] }], rate);
  assert.deepEqual(ranked.map(row => row.candidate.id), ["only-a", "needs-b"]);
  assert.ok(Math.abs(closureProbability("a", ["a", "b"], rate) - 0.16) < 1e-9);
});
