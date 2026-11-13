import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import test from "node:test";
import { startDocumentPreview } from "../src/preview.mjs";

test("the standalone preview serves math and assets, watches source, and preserves real feedback on restart", { timeout: 20000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-doc-review-"));
  const documents = join(directory, "documents");
  const storageRoot = join(directory, "state");
  mkdirSync(documents);
  const documentPath = join(documents, "review notes.md");
  const original = readFileSync(new URL("../examples/review.md", import.meta.url), "utf8");
  writeFileSync(documentPath, original);
  writeFileSync(join(documents, "review.svg"), readFileSync(new URL("../examples/review.svg", import.meta.url)));
  const sessionId = randomUUID();
  let notifications = 0;
  let preview;
  const options = {
    documentPath, sessionId, storageRoot,
    notify: async () => { notifications++; },
    onError: assert.fail,
  };
  try {
    preview = await startDocumentPreview(options);
    assert.match(preview.url, /^http:\/\/127\.0\.0\.1:\d+\/review%20notes$/);
    assert.deepEqual(readdirSync(documents).sort(), ["review notes.md", "review.svg"]);
    const html = await (await fetch(preview.url)).text();
    assert.match(html, /__preview_comments\/client\.js/);
    const rendered = await (await fetch(preview.url + ".md?import")).text();
    assert.match(rendered, /Review a document together/);
    assert.match(rendered, /mjx-container/);
    assert.equal(await (await fetch(preview.origin + "/review.svg")).text(),
      readFileSync(join(documents, "review.svg"), "utf8"));
    const headers = { "X-Preview-Comment": "1" };
    const status = await fetch(preview.origin + "/__preview_comments/status", { headers });
    assert.equal((await status.json()).sessionId, sessionId);
    const response = await fetch(preview.origin + "/__preview_comments/comments", {
      method: "POST", headers, body: JSON.stringify({
        id: randomUUID(), sessionId, url: preview.url,
        section: "A mathematical step", kind: "equation", quote: "Point mapping",
        comment: "Explain the denominator.",
      }),
    });
    assert.equal(response.status, 200);
    const id = (await response.json()).id;
    assert.equal(notifications, 1);
    assert.equal(preview.bridge.pending().count, 1);
    preview.bridge.read();
    preview.bridge.update({ id: randomUUID(), commentId: id, reply: "Clarified the point mapping.", resolved: true });
    writeFileSync(documentPath, original.replace("Review a document together", "An updated document"));
    let updated = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      if ((await (await fetch(preview.url + ".md?import")).text()).includes("An updated document")) {
        updated = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(updated, "VitePress must serve edits to the original Markdown.");
    const workspace = preview.workspace;
    const connectionFile = preview.bridge.connectionFile;
    await preview.close();
    assert.equal(existsSync(workspace), false);
    assert.equal(existsSync(connectionFile), false);
    assert.equal(existsSync(join(storageRoot, sessionId, "comments.jsonl")), true);
    await preview.close();
    preview = await startDocumentPreview(options);
    const thread = preview.bridge.list()[0];
    assert.equal(thread.id, id);
    assert.equal(thread.resolved, true);
    assert.equal(thread.replies[0].comment, "Clarified the point mapping.");
  } finally {
    if (preview) await preview.close();
    rmSync(directory, { recursive: true });
  }
});

test("startup rejects invalid inputs and occupied ports without leaving preview workspaces", async () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-doc-review-errors-"));
  const documentPath = join(directory, "document.md");
  const storageRoot = join(directory, "state");
  writeFileSync(documentPath, "# A document");
  const options = { documentPath, storageRoot, sessionId: randomUUID(), notify: async () => {}, onError: assert.fail };
  const occupied = createServer();
  await new Promise(resolve => occupied.listen(0, "127.0.0.1", resolve));
  try {
    await assert.rejects(startDocumentPreview({ ...options, port: -1 }), /port/);
    await assert.rejects(startDocumentPreview({ ...options, sessionId: "../other" }), /UUID/);
    await assert.rejects(startDocumentPreview({ ...options, documentPath: directory }), /Markdown/);
    await assert.rejects(startDocumentPreview({ ...options, port: occupied.address().port }), /already in use/);
    assert.equal(existsSync(join(storageRoot, options.sessionId, "connection.json")), false);
    assert.deepEqual(readdirSync(storageRoot), []);
  } finally {
    await new Promise(resolve => occupied.close(resolve));
    rmSync(directory, { recursive: true });
  }
});
