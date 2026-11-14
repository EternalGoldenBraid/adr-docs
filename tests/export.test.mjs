import { execFileSync } from "node:child_process";
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

test("export of several pages gives one zip with an html per page and reports progress", async () => {
  const root = mkdtempSync(join(tmpdir(), "adr-exp-"));
  writeFileSync(join(root, "index.md"), "# Home\n");
  writeFileSync(join(root, "a.md"), "# Alpha\n");
  writeFileSync(join(root, "skip.md"), "# Skipped\n");
  const out = join(root, "out.zip");
  const steps = [];
  const result = await exportPage({ documentRoot: root, pages: ["/", "/a"], outFile: out, onProgress: step => steps.push(step.done) });
  const listing = execFileSync("unzip", ["-Z1", out], { encoding: "utf8" }).split("\n");
  assert.equal(result.kind, "zip");
  assert.ok(listing.includes("index.html") && listing.includes("a.html") && !listing.includes("skip.html"));
  assert.equal(steps.at(-1), 4);
  rmSync(root, { recursive: true, force: true });
});

test("task lists render as read-only checkboxes", async () => {
  const { createMarkdownRenderer } = await import("vitepress");
  const { default: taskLists } = await import("../src/task-lists.mjs");
  const html = (await createMarkdownRenderer(tmpdir(), {})).use(taskLists).render("- [ ] open\n- [x] done *now*\n- plain [x] text\n\n1. [X] numbered\n");
  assert.equal((html.match(/<input class="task-box" type="checkbox" disabled>/g) || []).length, 1);
  assert.equal((html.match(/disabled checked>/g) || []).length, 2);
  assert.match(html, /<li class="task-item"><input[^>]*> open<\/li>/);
  assert.match(html, /plain \[x\] text/);
});
