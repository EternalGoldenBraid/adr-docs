import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import test from "node:test";
import { connectDocumentReview } from "../src/copilot.mjs";

test("the plugin manifest locates its extension entries and the package release", () => {
  const root = new URL("../", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("plugin.json", root), "utf8"));
  const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  assert.equal(manifest.version, pkg.version);
  const extensions = new URL(manifest.extensions + "/", root);
  const entries = readdirSync(extensions, { withFileTypes: true }).filter(entry => entry.isDirectory());
  assert.ok(entries.length > 0);
  for (const entry of entries) {
    assert.ok(statSync(new URL(entry.name + "/extension.mjs", extensions)).isFile());
  }
});

test("the Copilot plugin owns its preview and uses distinct tools with count-only attention", async () => {
  let registered;
  let idle;
  let pending = { count: 1, latestId: randomUUID() };
  let closed = 0;
  let processing = true;
  let passedOptions;
  const messages = [];
  const session = {
    sessionId: randomUUID(),
    rpc: { metadata: { isProcessing: async () => ({ processing }) } },
    on: (event, handler) => { assert.equal(event, "assistant.idle"); idle = handler; },
    send: async message => { messages.push(message); },
    log: assert.fail,
  };
  const bridge = {
    pending: () => pending,
    read: options => { pending = { count: 0 }; return [options]; },
    update: input => input,
  };
  const preview = {
    url: "http://127.0.0.1:8767/review", document: "/docs/review.md", bridge,
    close: async () => { closed++; },
  };
  await connectDocumentReview({
    joinSession: async options => { registered = options; return session; },
    startPreview: async options => { passedOptions = options; return preview; },
  });
  const tools = Object.fromEntries(registered.tools.map(tool => [tool.name, tool.handler]));
  assert.deepEqual(Object.keys(tools), ["start_doc_review", "list_workstreams", "list_doc_review_servers", "read_doc_review_comments", "unanswered_threads", "update_doc_review_comment", "add_doc_review_comment", "set_doc_review_status", "stop_doc_review"]);
  assert.throws(() => tools.read_doc_review_comments({}), /Start a document preview/);
  const started = JSON.parse(await tools.start_doc_review({ document_path: "/docs/review.md" }));
  assert.equal(started.url, preview.url);
  assert.equal(passedOptions.sessionId, session.sessionId);
  assert.equal(passedOptions.documentPath, "/docs/review.md");
  assert.equal(passedOptions.port, 0);
  await assert.rejects(tools.start_doc_review({ document_path: "/docs/other.md" }), /already open/);
  await passedOptions.notify();
  assert.deepEqual(messages, []);
  const hint = registered.hooks.onPostToolUse();
  assert.match(hint.additionalContext, /1 unread/);
  assert.match(hint.additionalContext, /read_doc_review_comments/);
  assert.equal(registered.hooks.onPostToolUseFailure(), undefined);
  assert.deepEqual(JSON.parse(tools.read_doc_review_comments({ include_seen: true })), [{ includeSeen: true }]);
  const commentId = randomUUID();
  const input = JSON.parse(tools.update_doc_review_comment({ comment_id: commentId, reply: "Updated the document." }));
  assert.equal(input.commentId, commentId);
  assert.equal(input.reply, "Updated the document.");
  assert.equal(Object.hasOwn(input, "resolved"), false);
  pending = { count: 1, latestId: randomUUID() };
  processing = false;
  idle({});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].mode, "immediate");
  assert.match(messages[0].prompt, /read_doc_review_comments/);
  await registered.hooks.onSessionEnd();
  assert.equal(closed, 1);
  assert.throws(() => tools.read_doc_review_comments({}), /Start a document preview/);
  await tools.stop_doc_review({});
  assert.equal(closed, 1);
});
