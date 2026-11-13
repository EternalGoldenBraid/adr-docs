import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readBoard } from "../src/workstreams.mjs";

test("readBoard parses front matter, legacy statuses and checklist progress", () => {
  const dir = mkdtempSync(join(tmpdir(), "ws-"));
  writeFileSync(join(dir, "2026-01-02-a.md"), "---\ntitle: A\nstatus: in-progress\nowner: me\ndepends_on: [b, c]\n---\n- [x] one\n- [ ] two\n");
  writeFileSync(join(dir, "b.md"), "---\nstatus: done\n---\nno steps\n");
  writeFileSync(join(dir, "index.md"), "ignored");
  const board = readBoard(dir);
  assert.deepEqual(board.items.map(i => [i.id, i.status]), [["2026-01-02-a", "active"], ["b", "done"]]);
  assert.deepEqual(board.items[0].depends_on, ["b", "c"]);
  assert.deepEqual([board.items[0].steps.done, board.items[0].steps.total, board.items[0].date], [1, 2, "2026-01-02"]);
  assert.equal(board.counts.done, 1);
});
