import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readCode } from "../scripts/code_viewer/serve.mjs";

test("code viewer serves only files inside a mapped checkout", () => {
  const base = mkdtempSync(join(tmpdir(), "code-"));
  const repo = join(base, "repo");
  mkdirSync(join(repo, "src"), { recursive: true });
  mkdirSync(join(repo, ".git"));
  writeFileSync(join(repo, "src", "a.py"), "x = 1\n");
  writeFileSync(join(repo, ".git", "config"), "secret");
  writeFileSync(join(base, "outside.txt"), "no");
  symlinkSync(join(base, "outside.txt"), join(repo, "src", "link.txt"));
  const repos = { r: { local: repo } };
  assert.equal(readCode(repos, "r", "src/a.py").text, "x = 1\n");
  assert.equal(readCode(repos, "other", "src/a.py").status, 404);
  assert.equal(readCode(repos, "r", "../outside.txt").status, 403);
  assert.equal(readCode(repos, "r", ".git/config").status, 403);
  assert.equal(readCode(repos, "r", "src/link.txt").status, 403);
  assert.equal(readCode(repos, "__proto__", "x").status, 404);
});
