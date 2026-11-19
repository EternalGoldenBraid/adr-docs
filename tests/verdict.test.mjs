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
