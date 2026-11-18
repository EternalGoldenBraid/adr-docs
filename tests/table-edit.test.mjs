import assert from "node:assert/strict";
import test from "node:test";
import { readCell, writeCell } from "../scripts/preview_comments/table-edit.mjs";

const page = [
  "---", "title: t", "---", "", "# Day", "",
  "| Item | Value |", "|---|---|", "| Date | 2026-11-19 |", "| Site | fill in |", "",
  "{editable: Value}", "", "```", "{editable}", "```", "",
].join("\n");

test("reads and rewrites one cell of the marked table, leaving the rest alone", () => {
  const { raw, hash } = readCell(page, 0, 1, 1);
  assert.equal(raw, "fill in");
  const next = writeCell(page, 0, 1, 1, "Oulu | clear", hash);
  assert.equal(next.split("\n")[9], "| Site | Oulu \\| clear |");
  assert.equal(next.split("\n").length, page.split("\n").length);
});

test("refuses stale pages, other columns, bad rows and multi-line values", () => {
  const { hash } = readCell(page, 0, 0, 1);
  assert.throws(() => writeCell(page + "x", 0, 0, 1, "a", hash), /changed/);
  assert.throws(() => readCell(page, 0, 0, 0), /not editable/);
  assert.throws(() => readCell(page, 0, 5, 1), /no longer exists/);
  assert.throws(() => readCell(page, 1, 0, 1), /no longer marked/);
  assert.throws(() => writeCell(page, 0, 0, 1, "a\nb", hash), /one line/);
});
