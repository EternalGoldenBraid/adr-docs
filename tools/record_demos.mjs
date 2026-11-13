// Records short feature demos of the preview as video (docs/demos/public/*.webm).
// Usage: npm run demos  (needs a Chromium; set CHROMIUM=/path if not /usr/bin/chromium)
import { copyFileSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { startDocumentPreview } from "../src/preview.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const outDir = join(root, "docs/demos/public");
const size = { width: 1100, height: 650 };
const wait = ms => new Promise(done => setTimeout(done, ms));
mkdirSync(outDir, { recursive: true });

const storage = mkdtempSync(join(tmpdir(), "adr-demos-"));
const preview = await startDocumentPreview({
  documentPath: join(root, "examples/index.md"), sessionId: randomUUID(), storageRoot: storage,
  notify: async () => {}, onError: error => console.error(error),
});
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/usr/bin/chromium", args: ["--no-sandbox"] });

async function caption(page, text) {
  await page.evaluate(text => {
    let el = document.getElementById("demo-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-caption";
      el.style.cssText = "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:8px 16px;" +
        "border-radius:8px;background:#1f6feb;color:#fff;font:600 16px system-ui;box-shadow:0 2px 10px #0008;max-width:90vw";
      document.body.append(el);
    }
    el.textContent = text;
  }, text);
  await wait(1600);
}

async function record(name, steps) {
  const videoDir = mkdtempSync(join(storage, "video-"));
  const context = await browser.newContext({ viewport: size, recordVideo: { dir: videoDir, size } });
  const page = await context.newPage();
  await steps(page);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join(outDir, `${name}.webm`));
  console.log("recorded", name);
}

// First visits make Vite re-optimise dependencies and reload; do that before recording.
for (const path of ["/", "/review", "/graph"]) {
  const warm = await browser.newPage();
  await warm.goto(preview.origin + path);
  await wait(6000);
  await warm.close();
}

const open = async (page, path) => { await page.goto(preview.origin + path); await wait(2500); };
const leader = async (page, key) => { await page.keyboard.press("-"); await wait(40); await page.keyboard.press(key); };
const type = (page, text) => page.keyboard.type(text, { delay: 70 });

try {
  await record("select-and-comment", async page => {
    await open(page, "/review");
    await caption(page, "Select text, then press c to comment");
    await page.evaluate(() => {
      const walker = document.createTreeWalker(document.querySelector(".vp-doc"), NodeFilter.SHOW_TEXT);
      for (let node; (node = walker.nextNode());) {
        const at = node.data.indexOf("coordinates");
        if (at < 0) continue;
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + 11);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        break;
      }
    });
    await wait(1000);
    await page.keyboard.press("c");
    await wait(600);
    await type(page, "Should this say homogeneous coordinates?");
    await caption(page, "Write the comment and save it; Copilot reads it");
    await page.locator("button[type=submit]").first().click();
    await wait(1500);
    await caption(page, "The highlight stays; -h opens all threads");
    await leader(page, "h");
    await wait(2500);
  });

  await record("command-line-help", async page => {
    await open(page, "/");
    await caption(page, "Press : for the command line");
    await page.keyboard.press(":");
    await wait(800);
    await type(page, "help");
    await page.keyboard.press("Enter");
    await caption(page, ":help lists every key and command");
    await wait(2500);
  });

  const a = preview.bridge.add({ page: "/graph", kind: "page", quote: "Graph", comment: "Is the Sense node the right entry point?" });
  const b = preview.bridge.add({ page: "/review", kind: "page", quote: "Review", comment: "The graph question depends on this page.", refs: [a.id] });
  preview.bridge.update({ id: randomUUID(), commentId: a.id, addRefs: [b.id] });
  await record("comment-links", async page => {
    await open(page, "/graph");
    await caption(page, "Threads can link to each other: -h opens the thread list");
    await leader(page, "h");
    await wait(1000);
    await page.locator(".thread-card", { hasText: "Sense node" }).click();
    await caption(page, "→ links to a related thread, ← is a backlink");
    await page.locator(".link-row button").first().click();
    await wait(4500);
    await caption(page, "It opened the other page's thread, with a backlink");
    await wait(1500);
  });
} finally {
  await browser.close();
  await preview.close();
  rmSync(storage, { recursive: true, force: true });
}
