import test from "node:test";
import assert from "node:assert/strict";
import { diffLines, hunks } from "../scripts/preview_comments/page-diff.mjs";

test("diff marks added and removed lines with new-file line numbers", () => {
  const rows = diffLines("a\nb\nc", "a\nB\nc\nd");
  assert.deepEqual(rows.filter(r => r.op !== " ").map(r => [r.op, r.text, r.line]), [["-", "b", 2], ["+", "B", 2], ["+", "d", 4]]);
});

test("a page with no earlier copy is all additions", () => {
  assert.ok(diffLines(undefined, "x\ny").every(r => r.op === "+"));
});

test("hunks keep context and split distant changes", () => {
  const before = Array.from({ length: 20 }, (_, i) => `l${i}`).join("\n");
  const after = before.replace("l2", "X").replace("l15", "Y");
  const result = hunks(diffLines(before, after), 1);
  assert.equal(result.length, 2);
  assert.equal(result[0].line, 2);
});
