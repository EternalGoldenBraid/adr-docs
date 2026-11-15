import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveLaunch } from "../src/launch.mjs";

const PIN = "ddd31c98-538d-4d82-8084-01e59933955e";

function site() {
  const root = mkdtempSync(join(tmpdir(), "adr-launch-"));
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "docs", "index.md"), "# Site\n");
  writeFileSync(join(root, "docs", "page.md"), "# Page\n");
  return root;
}

test("a directory is served from its index.md, with the port as a flag or a positional", () => {
  const root = site();
  try {
    const flag = resolveLaunch(["docs", "--port", "5174"], root);
    assert.equal(flag.document, join(root, "docs", "index.md"));
    assert.equal(flag.port, 5174);
    assert.deepEqual(resolveLaunch(["docs", "5174"], root), flag);
    assert.equal(resolveLaunch(["docs/page.md"], root).port, 0);
  } finally { rmSync(root, { recursive: true }); }
});

test("the store is --store, else the directory's .adr-store pin, else stable per served document", () => {
  const root = site();
  try {
    const hashed = resolveLaunch(["docs"], root).store;
    assert.equal(resolveLaunch([join(root, "docs", "index.md")]).store, hashed);
    assert.notEqual(resolveLaunch(["docs/page.md"], root).store, hashed);
    writeFileSync(join(root, "docs", ".adr-store"), PIN + "\n");
    assert.equal(resolveLaunch(["docs"], root).store, PIN);
    const other = "00000000-0000-4000-8000-000000000001";
    assert.equal(resolveLaunch(["docs", "--store", other], root).store, other);
  } finally { rmSync(root, { recursive: true }); }
});

test("bad launches are rejected before anything starts", () => {
  const root = site();
  try {
    for (const argv of [[], ["missing"], ["docs", "x"], ["docs", "1", "--port", "2"], ["docs", "--store", "abc"],
      ["docs", "--port"], ["docs", "--host", "0"]]) {
      assert.throws(() => resolveLaunch(argv, root), argv.join(" "));
    }
    rmSync(join(root, "docs", "index.md"));
    assert.throws(() => resolveLaunch(["docs"], root), /no index\.md/);
  } finally { rmSync(root, { recursive: true }); }
});

test("browser-blocked ports are refused, and stale servers are not listed", async () => {
  const { listServers } = await import("../src/servers.mjs");
  const root = site();
  try {
    assert.throws(() => resolveLaunch(["docs", "6666"], root), /blocked by browsers/);
    const store = join(root, "state");
    for (const [name, pid] of [["live", process.pid], ["dead", 2 ** 22 + 1]]) {
      mkdirSync(join(store, name), { recursive: true });
      writeFileSync(join(store, name, "connection.json"), JSON.stringify({ pid, previewOrigin: `http://127.0.0.1:${name === "live" ? 5180 : 5181}`, documentRoot: "/x" }));
    }
    assert.deepEqual(listServers(store, { prune: true }).map(row => row.store), ["live"]);
    assert.deepEqual(listServers(store).map(row => row.store), ["live"]);
  } finally {
    rmSync(root, { recursive: true });
  }
});
