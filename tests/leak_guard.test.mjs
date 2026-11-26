import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "leak-"));
const list = join(dir, "denylist");
writeFileSync(list, "secretword\n");
const run = (...args) =>
  spawnSync("tools/leak-guard.sh", args, { env: { ...process.env, ADR_DENYLIST: list }, encoding: "utf8" });

test("commit message with a denylisted term is rejected", () => {
  const f = join(dir, "msg");
  writeFileSync(f, "Add SecretWord theme\n");
  assert.equal(run("message", f).status, 1);
  writeFileSync(f, "Add theme\n");
  assert.equal(run("message", f).status, 0);
});

test("push range checks commit messages", () => {
  const git = (...a) => spawnSync("git", a, { cwd: dir, encoding: "utf8" });
  git("init", "-q");
  git("-c", "user.name=a", "-c", "user.email=a@b.c", "commit", "-q", "--allow-empty", "-m", "base");
  git("-c", "user.name=a", "-c", "user.email=a@b.c", "commit", "-q", "--allow-empty", "-m", "the secretword loop");
  const r = spawnSync(join(process.cwd(), "tools/leak-guard.sh"), ["range", "HEAD~1..HEAD"], {
    cwd: dir, env: { ...process.env, ADR_DENYLIST: list }, encoding: "utf8",
  });
  assert.equal(r.status, 1);
});
