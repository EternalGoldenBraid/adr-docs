import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { exportPage } from "../src/export.mjs";

test("export produces one self-contained html: inlined script, image and no module loads", async () => {
  const root = mkdtempSync(join(tmpdir(), "adr-exp-"));
  writeFileSync(join(root, "index.md"), "# Hello\n\n<img src=\"/dot.png\">\n\n<iframe src=\"http://localhost:9999/x\"></iframe>\n");
  writeFileSync(join(root, "other.md"), "---\nsummary: bad: yaml: here\n  - [\n---\n# Broken");
  writeFileSync(join(root, "dot.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64"));
  const out = join(root, "out.html");
  const result = await exportPage({ documentPath: join(root, "index.md"), outFile: out });
  const html = readFileSync(out, "utf8");
  assert.equal(result.kind, "html");
  assert.match(html, /<img src="data:image\/png;base64,/);
  assert.doesNotMatch(html, /<script type="module"|rel="modulepreload"|<iframe/);
  assert.match(html, /Interactive viewer not available/);
  assert.equal(result.warnings.length, 1);
  rmSync(root, { recursive: true, force: true });
});
