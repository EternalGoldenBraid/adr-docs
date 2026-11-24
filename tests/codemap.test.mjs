import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("codemap nests folders, files and symbols, links the source and checks reachability", () => {
  const dir = mkdtempSync(join(tmpdir(), "codemap-"));
  try {
    mkdirSync(join(dir, "app/pkg"), { recursive: true });
    writeFileSync(join(dir, "app/pkg/node.py"), "class A:\n    def run(self):\n        self.create_publisher(M, '/out', 1)\n\ndef main():\n    pass\n");
    writeFileSync(join(dir, "app/readme.md"), "hi\n");
    const cfg = join(dir, "c.json");
    writeFileSync(cfg, JSON.stringify({ out: join(dir, "g.json"), repos: [{ name: "app", path: join(dir, "app") }], interfaces: [{ title: "Out", file: "app:pkg/node.py", match: "def main" }] }));
    const script = new URL("../scripts/codemap/codemap.py", import.meta.url).pathname;
    execFileSync("python3", [script, cfg]);
    const g = JSON.parse(readFileSync(join(dir, "g.json"), "utf8"));
    const by = id => g.nodes.find(n => n.id === id);
    assert.equal(by("app:dir:pkg").inside, "L:repo:app");
    assert.equal(by("app:file:pkg/node.py").inside, "app:dir:pkg");
    assert.equal(by("app:sym:pkg/node.py:main").code, "app:pkg/node.py#L5");
    assert.equal(by("app:sym:pkg/node.py:A.run").inside, "app:sym:pkg/node.py:A");
    assert.ok(by("ros:app:pkg/node.py"));
    assert.equal(by("ifc:0").code, "app:pkg/node.py#L5");
    assert.equal(by("ifc:0").inside, "L:ifc");
    assert.match(execFileSync("python3", [script, cfg, "--check"]).toString(), /^ok/);
    writeFileSync(join(dir, "app/new.txt"), "x\n");
    assert.throws(() => execFileSync("python3", [script, cfg, "--check"], { stdio: "pipe" }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
