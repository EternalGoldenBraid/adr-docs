// Manual browser regression (needs a running preview): node tests/calm.browser.mjs http://127.0.0.1:5173/page
// A host page with its own window keydown handler must see every key in calm mode, and ":" must still open ADR's command line.
import { chromium } from "playwright-core";

const url = process.argv[2];
if (!url) throw new Error("Usage: node tests/calm.browser.mjs <preview page url>");
const path = new URL(url).pathname.replace(/\.html$/, "").replace(/\/index$/, "/");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/usr/bin/chromium", args: ["--no-sandbox"] });
const keys = ["w", "a", "s", "d", "ArrowUp"];
try {
  for (const calm of [true, false]) {
    const page = await browser.newPage();
    await page.addInitScript(([on, p]) => {
      if (on) localStorage.setItem("preview-comments-calm", JSON.stringify([p]));
      window.hostKeys = [];
      addEventListener("keydown", event => window.hostKeys.push(event.key));
    }, [calm, path]);
    await page.goto(url, { waitUntil: "load" });
    await page.waitForSelector("#preview-comment-overlay", { state: "attached" });
    await page.waitForTimeout(1500);
    for (const key of keys) await page.keyboard.press(key);
    const seen = await page.evaluate(() => window.hostKeys);
    if (calm) {
      if (seen.join() !== keys.join()) throw new Error(`calm: host saw ${seen}`);
      await page.keyboard.press(":");
      const command = await page.evaluate(() => !!document.getElementById("preview-comment-overlay").shadowRoot.activeElement);
      if (!command) throw new Error("calm: ':' did not open the command line");
    } else if (seen.join() === keys.join()) {
      throw new Error("normal: expected ADR's `s` prefix to swallow later keys");
    }
    await page.close();
  }
  console.log("calm browser regression passed");
} finally {
  await browser.close();
}
