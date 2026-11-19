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
