import test from "node:test";
import assert from "node:assert/strict";
import { needsVerdict } from "../src/page-tree.mjs";

const done = "---\ncard-status: shipped\n---\n# T\n";

test("a finished page needs non-empty Verdict and Learnings sections", () => {
  assert.equal(needsVerdict(done), true);
  assert.equal(needsVerdict(`${done}## Verdict\n\n## Learnings\nx\n`), true);
  assert.equal(needsVerdict(`${done}## Verdict\nok\n## Learnings\nx\n`), false);
});

test("an unfinished page is never flagged", () => {
  assert.equal(needsVerdict("---\ncard-status: building\n---\n# T\n"), false);
});

test("cards list each card-test with its status and date", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pageCards } = await import("../src/page-tree.mjs");
  const dir = mkdtempSync(join(tmpdir(), "cards-"));
  writeFileSync(join(dir, "a.md"), "---\ncard-line: x\ncard-test: Stage 1 | done | 2026-11-19\ncard-test: Stage 2 | running\n---\n# A\n");
  assert.deepEqual(pageCards(dir)["/a"].tests, [{ name: "Stage 1", status: "done", at: "2026-11-19" }, { name: "Stage 2", status: "running" }]);
});

test("the nested card: block gives the line, badge and tests", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pageCards } = await import("../src/page-tree.mjs");
  const dir = mkdtempSync(join(tmpdir(), "cards-"));
  writeFileSync(join(dir, "b.md"), "---\ncard:\n  gist: \"Why?\"\n  state: planned\n  owner: PC lead\n  tests:\n    - {name: \"Run 1\", state: running, date: 2026-11-19}\nstatus: running\n---\n# B\n");
  const card = pageCards(dir)["/b"];
  assert.deepEqual([card.line, card.status, card.owner, card.tests], ["Why?", "running", "PC lead", [{ name: "Run 1", status: "running", at: "2026-11-19" }]]);
});

test("a test's result file drives its state and the page state is derived", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pageCards } = await import("../src/page-tree.mjs");
  const dir = mkdtempSync(join(tmpdir(), "res-"));
  writeFileSync(join(dir, "r.json"), '{"status":"failed","finished_at":"2026-11-19T10:00:00Z"}');
  writeFileSync(join(dir, "c.md"), "---\ncard:\n  state: planned\n  tests:\n    - {name: \"A\", state: running, result: r.json}\n    - {name: \"B\", state: done}\n---\n# C\n");
  const card = pageCards(dir)["/c"];
  assert.deepEqual([card.status, card.tests[0].status, card.tests[0].at, card.statusMismatch], ["failed", "failed", "2026-11-19", "planned"]);
});

test("a card without an owner lists the missing mandatory fields", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pageCards } = await import("../src/page-tree.mjs");
  const dir = mkdtempSync(join(tmpdir(), "miss-"));
  writeFileSync(join(dir, "m.md"), "---\ncard:\n  gist: \"Why\"\n  state: planned\n---\n# M\n");
  assert.deepEqual(pageCards(dir)["/m"].missing, ["owner"]);
});

test("page front-matter owner becomes the card owner", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pageCards } = await import("../src/page-tree.mjs");
  const dir = mkdtempSync(join(tmpdir(), "own-"));
  writeFileSync(join(dir, "o.md"), "---\nowner: pc-lead\ncard:\n  gist: \"G\"\n  state: planned\n---\n# O\n");
  assert.equal(pageCards(dir)["/o"].owner, "pc-lead");
});
