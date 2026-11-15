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
  assert.deepEqual(pagesOf(searchPages(root, { pattern: "needle", from: "/a/c", down: 0, up: -1 })), ["/", "/a/", "/a/b", "/a/c"]);
  assert.throws(() => searchPages(root, { pattern: "(" }));
});

test("group-by: status nests tickets under virtual status groups", async () => {
  const { readPageTree } = await import("../src/page-tree.mjs");
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const root = mkdtempSync(tmpdir() + "/grp-");
  mkdirSync(root + "/workstreams");
  writeFileSync(root + "/index.md", "# Home\n");
  writeFileSync(root + "/workstreams/index.md", "---\ngroup-by: status\n---\n# WS\n");
  writeFileSync(root + "/workstreams/a.md", "---\nstatus: Done\n---\n# A\n");
  writeFileSync(root + "/workstreams/b.md", "---\nstatus: active\n---\n# B\n");
  const pages = readPageTree(root);
  const by = Object.fromEntries(pages.map(p => [p.slug, p]));
  assert.equal(by["workstreams/a"].parent, "workstreams/index#done");
  assert.equal(by["workstreams/index#active"].parent, "workstreams/index");
  assert.equal(by["workstreams/index#active"].link, "/workstreams/#active");
  assert.equal(readPageTree(root, { grouped: false }).length, 4);
});

test("the team page table is the roster", async () => {
  const { readRoster } = await import("../src/roster.mjs");
  const root = mkdtempSync(join(tmpdir(), "roster-"));
  writeFileSync(join(root, "index.md"), "# Home\n");
  writeFileSync(join(root, "team.md"), "# Team\n\n| Who | Role | Machine | Session | Harness | Working on |\n|---|---|---|---|---|---|\n| Nicklas | Lead | | | | |\n| GPU agent | Builder | gpu-box | `28588d53-1116-45c0-947d-69fc9bc1c727` | copilot | Run 7 |\n");
  const roster = readRoster(root);
  assert.equal(roster.length, 2);
  assert.deepEqual(roster[1], { name: "GPU agent", slug: "gpu-agent", role: "Builder", machine: "gpu-box", harness: "copilot", work: "Run 7", session: "28588d53-1116-45c0-947d-69fc9bc1c727" });
  assert.equal(roster[0].session, "");
});
