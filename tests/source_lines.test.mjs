import test from "node:test";
import assert from "node:assert/strict";
import { createMarkdownRenderer } from "vitepress";
import sourceLines, { bodyOffset, windowOf, replaceWindow } from "../src/source-lines.mjs";

test("blocks carry their body line range and the window skips front matter", async () => {
  const md = await createMarkdownRenderer(process.cwd(), { config: m => m.use(sourceLines) });
  const html = md.render("# Title\n\ntext one\ntext two\n\n- a\n- b\n");
  assert.match(html, /<h1 [^>]*data-adr-src="0,1">/);
  assert.match(html, /<p data-adr-src="2,4">/);
  assert.match(html, /<ul data-adr-src="5,7">/);
  const page = "---\nnav: x\n---\n# Title\n\ntext\n";
  assert.equal(bodyOffset(page), 3);
  const win = windowOf(page, 2, 3, 8);
  assert.deepEqual([win.from, win.raw.split("\n")[win.focus[0]]], [3, "text"]);
});

test("replacing a window rewrites only those lines", () => {
  assert.equal(replaceWindow("a\nb\nc", 1, 2, "x\ny"), "a\nx\ny\nc");
  assert.throws(() => replaceWindow("a", 0, 5, ""), /Invalid/);
});
