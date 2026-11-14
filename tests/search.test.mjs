import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { searchPages } from "../src/search.mjs";

function site() {
  const root = mkdtempSync(join(tmpdir(), "adr-search-"));
  mkdirSync(join(root, "a"));
  writeFileSync(join(root, "index.md"), "# Home\nneedle at root\n");
  writeFileSync(join(root, "a", "index.md"), "# A\nNeedle in a\n");
  writeFileSync(join(root, "a", "b.md"), "---\nparent: a/index\n---\n# B\nneedle in b\n");
  writeFileSync(join(root, "a", "c.md"), "---\nparent: a/b\n---\n# C\nneedle in c\n");
  return root;
}
const pagesOf = result => [...new Set(result.hits.map(hit => hit.link))];

test("search is smart-case, scopes by depth below and levels up", () => {
  const root = site();
  assert.equal(searchPages(root, { pattern: "needle" }).hits.length, 4);
  assert.equal(searchPages(root, { pattern: "Needle" }).hits.length, 1);
  assert.equal(searchPages(root, { pattern: "needle", caseSensitive: true }).hits.length, 3);
  assert.deepEqual(pagesOf(searchPages(root, { pattern: "needle", from: "/a/b", down: 0 })), ["/a/b"]);
  assert.deepEqual(pagesOf(searchPages(root, { pattern: "needle", from: "/a/b", down: 1 })), ["/a/b", "/a/c"]);
  assert.deepEqual(pagesOf(searchPages(root, { pattern: "needle", from: "/a/b", down: 0, up: 1 })), ["/a/", "/a/b"]);
  assert.throws(() => searchPages(root, { pattern: "(" }));
});
