import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import test from "node:test";
import { startCommentBridge } from "../scripts/preview_comments/server.mjs";
import { previewComments } from "../scripts/preview_comments/vite-plugin.mjs";
import { commentAttention, withdrawLegacyComments } from "../scripts/preview_comments/extension.mjs";

test("feedback stays unread across notification failure, legacy receipts and restart until explicitly fetched", async () => {
  const directory = mkdtempSync(join(tmpdir(), "preview-comments-"));
  const sessionId = randomUUID();
  writeFileSync(join(directory, "state.md"), "# State\n\nAn uncertain state.");
  let bridge;
  let attempts = 0;
  let fail = true;
  const errors = [];
  const options = {
    sessionId, documentRoot: directory, storageRoot: directory,
    previewOrigin: "http://127.0.0.1:8766",
    onError: error => errors.push(error.message),
    notify: async (...args) => {
      attempts++;
      assert.equal(args.length, 0);
      assert.match(readFileSync(join(directory, sessionId, "comments.jsonl"), "utf8"), /Clarify/);
      if (fail) throw new Error("Session is unavailable");
      await new Promise(resolve => setTimeout(resolve, 10));
    },
  };
  const input = {
    sessionId, id: randomUUID(), url: "http://127.0.0.1:8766/state#state",
    section: "State", anchor: "state", kind: "text",
    quote: "An uncertain state.", comment: "Clarify this: ε is estimation error.",
  };
  async function send(body, authorized = true) {
    const connection = JSON.parse(readFileSync(bridge.connectionFile));
    const response = await fetch(`http://127.0.0.1:${connection.port}/comments`, {
      method: "POST",
      headers: { Authorization: authorized ? `Bearer ${connection.token}` : "wrong" },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  try {
    bridge = await startCommentBridge(options);
    assert.equal((await send(input, false)).status, 403);
    assert.equal((await send({ ...input, sessionId: randomUUID() })).status, 400);
    assert.equal((await send({ ...input, url: "https://elsewhere.test/state" })).status, 400);
    assert.equal((await send({ ...input, comment: " " })).status, 400);
    assert.equal((await send({ ...input, comment: "x".repeat(30_000) })).status, 413);
    assert.equal(bridge.list().length, 0);

    const failed = await send(input);
    assert.equal(failed.status, 503);
    assert.equal(failed.body.saved, true);
    assert.match(failed.body.error, /unavailable/);
    assert.deepEqual(errors, ["Session is unavailable"]);
    assert.equal(bridge.pending().count, 1);
    await bridge.close();
    appendFileSync(join(directory, sessionId, "comments.jsonl"), JSON.stringify({
      event: "queued", id: input.id, at: new Date().toISOString(),
    }) + "\n");

    bridge = await startCommentBridge(options);
    assert.equal(bridge.list()[0].comment, input.comment);
    assert.equal(bridge.pending().count, 1);
    fail = false;
    const retries = await Promise.all([send(input), send(input)]);
    assert.ok(retries.every(result => result.status === 200 && result.body.awaitingReview));
    assert.equal(attempts, 3);
    assert.equal(bridge.list().length, 1);
    assert.equal((await send({ ...input, comment: "Different content" })).status, 409);
    assert.equal(bridge.read()[0].comment, input.comment);
    assert.deepEqual(bridge.read(), []);
    assert.equal(bridge.pending().count, 0);

    await bridge.close();
    bridge = await startCommentBridge(options);
    assert.equal(bridge.pending().count, 0);
    assert.equal((await send(input)).body.awaitingReview, false);
    assert.equal(bridge.read({ includeSeen: true }).length, 1);
    const records = readFileSync(join(directory, sessionId, "comments.jsonl"), "utf8")
      .trim().split("\n").map(line => JSON.parse(line));
    assert.deepEqual(records.map(record => record.event), ["comment", "queued", "seen"]);
    assert.match(records[0].sourceHash, /^[a-f0-9]{64}$/);
  } finally {
    if (bridge) await bridge.close();
    rmSync(directory, { recursive: true });
  }
});

test("the Vite adapter admits only the owning preview and forwards into its session", async () => {
  const directory = mkdtempSync(join(tmpdir(), "preview-comments-proxy-"));
  const sessionId = randomUUID();
  writeFileSync(join(directory, "state.md"), "# State");
  let handler;
  const proxy = createServer((request, response) => handler(request, response, () => {
    response.writeHead(404);
    response.end();
  }));
  await new Promise(resolve => proxy.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${proxy.address().port}`;
  let notifications = 0;
  const bridge = await startCommentBridge({
    sessionId, documentRoot: directory, storageRoot: directory, previewOrigin: origin,
    notify: async () => { notifications++; },
    onError: error => { throw error; },
  });
  try {
    const plugin = previewComments({ connectionFile: bridge.connectionFile });
    assert.throws(() => plugin.configureServer({ config: { server: { host: "0.0.0.0" } } }), /loopback/);
    plugin.configureServer({
      config: { server: { host: "127.0.0.1" }, logger: { error: assert.fail } },
      middlewares: { use: middleware => { handler = middleware; } },
    });
    const endpoint = origin + "/__preview_comments";
    assert.equal((await fetch(endpoint + "/status")).status, 403);
    assert.equal((await fetch(endpoint + "/status", {
      headers: { Origin: "https://unrelated.example", "X-Preview-Comment": "1" },
    })).status, 403);
    const ready = await fetch(endpoint + "/status", {
      headers: { Origin: origin, "X-Preview-Comment": "1" },
    });
    assert.equal((await ready.json()).sessionId, sessionId);
    const accepted = await fetch(endpoint + "/comments", {
      method: "POST",
      headers: { Origin: origin, "X-Preview-Comment": "1" },
      body: JSON.stringify({
        id: randomUUID(), sessionId, url: origin + "/state",
        section: "State", kind: "figure", quote: "Uncertainty cloud",
        comment: "Clarify the orange arrow.",
      }),
    });
    const created = await accepted.json();
    assert.equal(created.awaitingReview, true);
    assert.equal(notifications, 1);
    const history = await fetch(endpoint + "/history", { headers: { "X-Preview-Comment": "1" } });
    assert.equal((await history.json()).comments[0].resolved, false);
    const update = await fetch(endpoint + "/updates", {
      method: "POST", headers: { "X-Preview-Comment": "1" },
      body: JSON.stringify({ sessionId, id: randomUUID(), commentId: created.id, resolved: true }),
    });
    assert.equal((await update.json()).resolved, true);
    assert.equal(notifications, 2);
  } finally {
    await bridge.close();
    await new Promise(resolve => proxy.close(resolve));
    rmSync(directory, { recursive: true });
  }
});

test("history persists replies and explicit resolution; only user updates renew unread attention", async () => {
  const directory = mkdtempSync(join(tmpdir(), "preview-comment-history-"));
  const sessionId = randomUUID();
  writeFileSync(join(directory, "state.md"), "# State");
  let bridge;
  let fail = false;
  const errors = [];
  const options = {
    sessionId, documentRoot: directory, storageRoot: directory,
    previewOrigin: "http://127.0.0.1:8766", onError: error => errors.push(error.message),
    notify: async () => { if (fail) throw new Error("Notification unavailable"); },
  };
  async function request(path, body) {
    const connection = JSON.parse(readFileSync(bridge.connectionFile));
    const response = await fetch(`http://127.0.0.1:${connection.port}${path}`, {
      method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${connection.token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  }
  const first = randomUUID();
  const second = randomUUID();
  try {
    bridge = await startCommentBridge(options);
    for (const id of [first, second]) {
      assert.equal((await request("/comments", {
        id, sessionId, url: options.previewOrigin + "/state", section: "State",
        kind: "text", quote: "State", comment: "Explain this state.",
      })).status, 200);
    }
    const initial = await request("/history");
    assert.ok(initial.body.comments.every(comment => !comment.resolved && !comment.seen));
    assert.equal(bridge.pending().count, 2);
    bridge.read();
    assert.ok(bridge.list().every(comment => comment.seen && !comment.resolved));
    const outcome = { id: randomUUID(), commentId: first, reply: "Clarified in commit abc123.", resolved: true };
    bridge.update(outcome);
    bridge.update(outcome);
    assert.equal(bridge.list()[0].replies.length, 1);
    assert.equal(bridge.pending().count, 0);
    assert.throws(() => bridge.update({ ...outcome, reply: "Different reply" }), /different content/);
    assert.throws(() => bridge.update({ ...outcome, id: randomUUID(), reply: "ε".repeat(4097) }), /8192 UTF-8 bytes/);
    assert.throws(() => bridge.update({ ...outcome, id: randomUUID() }, "unknown"), /Invalid reply author/);

    const followup = {
      id: randomUUID(), sessionId, commentId: first, author: "copilot",
      reply: "<img src=x onerror=alert(1)> What about velocity?",
    };
    fail = true;
    const saved = await request("/updates", followup);
    assert.equal(saved.status, 503);
    assert.equal(saved.body.saved, true);
    assert.deepEqual(errors, ["Notification unavailable"]);
    assert.equal(bridge.pending().latestId, followup.id);
    await bridge.close();
    bridge = await startCommentBridge(options);
    assert.equal(bridge.pending().count, 1);
    assert.equal(bridge.pending().latestId, followup.id);
    fail = false;
    const retried = await request("/updates", followup);
    assert.equal(retried.status, 200);
    const thread = bridge.list()[0];
    assert.equal(thread.resolved, true);
    assert.equal(thread.replies.length, 2);
    assert.equal(thread.replies[1].author, "user");
    assert.equal(thread.replies[1].comment, followup.reply);
    const reopened = { id: randomUUID(), sessionId, commentId: first, resolved: false };
    assert.equal((await request("/updates", { ...reopened, id: first })).status, 409);
    assert.equal((await request("/updates", reopened)).body.resolved, false);
    assert.equal(bridge.pending().latestId, reopened.id);
    assert.equal((await request("/updates", { ...reopened, resolved: true })).status, 409);
    assert.equal((await request("/updates", { ...reopened, id: randomUUID(), resolved: "yes" })).status, 400);
    assert.equal((await request("/updates", { id: randomUUID(), sessionId, commentId: randomUUID(), reply: "Unknown" })).status, 400);
    assert.equal((await request("/updates", { id: randomUUID(), sessionId, commentId: first, reply: " " })).status, 400);
    assert.equal((await request("/updates", { id: randomUUID(), sessionId: randomUUID(), commentId: first, resolved: true })).status, 400);
    assert.equal(bridge.read()[0].resolved, false);
    await bridge.close();
    bridge = await startCommentBridge(options);
    assert.equal(bridge.pending().count, 0);
    assert.equal(bridge.list()[0].resolved, false);
    assert.equal(bridge.list()[0].replies.length, 2);
    const final = await request("/history");
    const records = readFileSync(join(directory, sessionId, "comments.jsonl"), "utf8").trim().split("\n");
    assert.equal(final.body.revision, records.length);
  } finally {
    if (bridge) await bridge.close();
    rmSync(directory, { recursive: true });
  }
});

test("busy work receives one count hint; idle work wakes immediately with no comment bodies or queued prompts", async () => {
  let processing = true;
  let inbox = { count: 1, latestId: "first" };
  let reject = false;
  const messages = [];
  const attention = commentAttention({
    rpc: { metadata: { isProcessing: async () => ({ processing }) } },
    send: async message => {
      if (reject) throw new Error("Cannot notify");
      messages.push(message);
    },
  }, () => inbox);
  await attention.wakeIfIdle();
  assert.equal(messages.length, 0);
  assert.match(attention.hint(), /^1 unread browser comment/);
  assert.equal(attention.hint(), undefined);
  processing = false;
  inbox = { count: 2, latestId: "second" };
  await Promise.all([attention.wakeIfIdle(), attention.wakeIfIdle()]);
  assert.deepEqual(messages, [{
    prompt: "2 unread browser comment(s) available. Use get_preview_comments if relevant to the current work; otherwise leave them pending.",
    mode: "immediate",
  }]);
  assert.equal(attention.hint(), undefined);
  inbox = { count: 3, latestId: "third" };
  reject = true;
  await assert.rejects(attention.wakeIfIdle(), /Cannot notify/);
  reject = false;
  await attention.wakeIfIdle();
  assert.equal(messages.length, 2);
  inbox = { count: 0 };
  assert.equal(attention.hint(), undefined);
});

test("migration withdraws only saved legacy comment prompts by stable queue ID", async () => {
  const id = randomUUID();
  const unknown = randomUUID();
  const removed = [];
  await withdrawLegacyComments({
    rpc: { queue: {
      pendingItems: async () => ({ items: [
        { id: "owned", kind: "message", displayText: `[Browser comment ${id}]\nFeedback` },
        { id: "human", kind: "message", displayText: "Please continue." },
        { id: "unknown", kind: "message", displayText: `[Browser comment ${unknown}]\nOther feedback` },
        { id: "command", kind: "command", displayText: "/help" },
      ] }),
      removeAt: async ({ id: item }) => { removed.push(item); return { removed: true }; },
    } },
  }, [{ id, queued: true }]);
  assert.deepEqual(removed, ["owned"]);
});

test("PNG attachments attach to new comments and threads and reach the agent as file paths", async () => {
  const directory = mkdtempSync(join(tmpdir(), "preview-comment-images-"));
  const sessionId = randomUUID();
  writeFileSync(join(directory, "state.md"), "# State");
  const origin = "http://127.0.0.1:8766";
  const bridge = await startCommentBridge({
    sessionId, documentRoot: directory, storageRoot: directory, previewOrigin: origin,
    onError: () => {}, notify: async () => {},
  });
  const connection = JSON.parse(readFileSync(bridge.connectionFile));
  const call = (path, init = {}) => fetch(`http://127.0.0.1:${connection.port}${path}`, {
    ...init, headers: { Authorization: `Bearer ${connection.token}`, ...init.headers },
  });
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("pixels")]);
  try {
    assert.equal((await call("/attachments", { method: "POST", body: Buffer.from("not a png") })).status, 400);
    const { id } = await (await call("/attachments", { method: "POST", body: png })).json();
    assert.match(id, /^[\da-f]{64}$/);
    assert.deepEqual(Buffer.from(await (await call(`/attachments/${id}`)).arrayBuffer()), png);
    const commentId = randomUUID();
    const post = (path, body) => call(path, { method: "POST", body: JSON.stringify(body) });
    const base = { id: commentId, sessionId, url: origin + "/state", section: "State", kind: "figure", quote: "Region screenshot", comment: "See this." };
    assert.equal((await post("/comments", { ...base, images: ["f".repeat(64)] })).status, 400);
    assert.equal((await post("/comments", { ...base, images: [id] })).status, 200);
    const second = (await (await call("/attachments", { method: "POST", body: Buffer.concat([png, Buffer.from("2")]) })).json()).id;
    bridge.read();
    assert.equal((await post("/updates", { id: randomUUID(), sessionId, commentId, addImages: [second] })).status, 200);
    assert.equal(bridge.pending().count, 1);
    const [comment] = bridge.read();
    assert.deepEqual(comment.images, [id, second]);
    assert.deepEqual(comment.imageFiles, [id, second].map(name => join(directory, sessionId, "attachments", name + ".png")));
  } finally {
    await bridge.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("agent-authored threads are red, quiet, listed, and wake the agent only on a user reply", async () => {
  const directory = mkdtempSync(join(tmpdir(), "preview-comments-"));
  const sessionId = randomUUID();
  writeFileSync(join(directory, "page.md"), "# Page\n\nEquation here.");
  let wakes = 0;
  const bridge = await startCommentBridge({
    sessionId, documentRoot: directory, storageRoot: directory, previewOrigin: "http://127.0.0.1:8767",
    onError: error => assert.fail(error.message), notify: async () => { wakes++; },
  });
  const { id } = bridge.add({ page: "/page", kind: "equation", quote: "Equation (1)", comment: "Check this step." });
  const [thread] = bridge.list();
  assert.equal(thread.author, "copilot");
  assert.equal(thread.color, "red");
  assert.equal(thread.resolved, false);
  assert.deepEqual(bridge.pending(), { count: 0, latestId: undefined });
  assert.throws(() => bridge.add({ page: "/missing", kind: "text", quote: "x", comment: "y" }));
  bridge.update({ id: randomUUID(), sessionId, commentId: id, reply: "Looked at it" }, "user");
  assert.equal(bridge.pending().count, 1);
  await bridge.close();
  rmSync(directory, { recursive: true, force: true });
});

test("threads link to other threads; links are validated and removable without waking the agent", async () => {
  const directory = mkdtempSync(join(tmpdir(), "preview-comments-"));
  const sessionId = randomUUID();
  writeFileSync(join(directory, "page.md"), "# Page\n\nText.");
  const bridge = await startCommentBridge({
    sessionId, documentRoot: directory, storageRoot: directory, previewOrigin: "http://127.0.0.1:8767",
    onError: error => assert.fail(error.message), notify: async () => {},
  });
  const a = bridge.add({ page: "/page", kind: "page", quote: "Page", comment: "a" }).id;
  const b = bridge.add({ page: "/page", kind: "page", quote: "Page", comment: "b", refs: [a] }).id;
  assert.deepEqual(bridge.list().find(c => c.id === b).refs, [a]);
  bridge.update({ id: randomUUID(), commentId: a, addRefs: [b] });
  assert.deepEqual(bridge.list().find(c => c.id === a).refs, [b]);
  assert.throws(() => bridge.update({ id: randomUUID(), commentId: a, addRefs: [a] }));
  assert.throws(() => bridge.update({ id: randomUUID(), commentId: a, addRefs: [randomUUID()] }));
  bridge.update({ id: randomUUID(), sessionId, commentId: a, removeRefs: [b] }, "user");
  assert.deepEqual(bridge.list().find(c => c.id === a).refs, []);
  assert.equal(bridge.pending().count, 0);
  await bridge.close();
  rmSync(directory, { recursive: true, force: true });
});

test("an agent reply can carry a proposal that stays in the thread", async () => {
  const directory = mkdtempSync(join(tmpdir(), "preview-comments-"));
  writeFileSync(join(directory, "page.md"), "# Page\n\nText.");
  const bridge = await startCommentBridge({
    sessionId: randomUUID(), documentRoot: directory, storageRoot: directory, previewOrigin: "http://127.0.0.1:8767",
    onError: error => assert.fail(error.message), notify: async () => {},
  });
  const id = bridge.add({ page: "/page", kind: "page", quote: "Page", comment: "a" }).id;
  bridge.update({ id: randomUUID(), commentId: id, proposal: { before: "Text.", after: "Better." } });
  const [reply] = bridge.list().find(c => c.id === id).replies;
  assert.deepEqual(reply.proposal, { before: "Text.", after: "Better." });
  assert.equal(reply.author, "copilot");
  await bridge.close();
  rmSync(directory, { recursive: true, force: true });
});

test("page tree: parent and order front matter shape the top bar and tree.json", async () => {
  const { readPageTree, topBar, nestedTree } = await import("../src/page-tree.mjs");
  const directory = mkdtempSync(join(tmpdir(), "page-tree-"));
  writeFileSync(join(directory, "index.md"), "# Plan\n");
  writeFileSync(join(directory, "b.md"), "---\nparent: index\norder: 2\n---\n# B\n");
  writeFileSync(join(directory, "a.md"), "---\nparent: index\nnav: Alpha\norder: 1\n---\n# A\n");
  writeFileSync(join(directory, "lost.md"), "---\nparent: missing\n---\n# Lost\n");
  const pages = readPageTree(directory);
  assert.deepEqual(topBar(pages).map(item => item.text), ["Plan", "Lost"]);
  const [root] = nestedTree(pages);
  assert.deepEqual(root.children.map(child => child.title), ["Alpha", "B"]);
  rmSync(directory, { recursive: true, force: true });
});

test("keymap overrides are deep-merged over defaults", async () => {
  const { loadKeymap } = await import("../scripts/preview_comments/keymap.mjs");
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const file = join(mkdtempSync(join(tmpdir(), "km-")), "keymap.json");
  writeFileSync(file, JSON.stringify({ resize: { wider: "A-L" }, page: { region: "S" } }));
  const map = loadKeymap({ ADR_KEYMAP: file });
  assert.equal(map.resize.wider, "A-L");
  assert.equal(map.resize.narrower, "A-h");
  assert.equal(map.page.region, "S");
  assert.equal(map.page.motions.h[0], "backward");
  writeFileSync(file, "{bad");
  assert.equal(loadKeymap({ ADR_KEYMAP: file }, () => {}).page.region, "s");
});

test("resolving records when, so later replies can resurface the thread", async () => {
  const directory = mkdtempSync(join(tmpdir(), "preview-comments-"));
  writeFileSync(join(directory, "page.md"), "# Page\n\nText.");
  const bridge = await startCommentBridge({
    sessionId: randomUUID(), documentRoot: directory, storageRoot: directory, previewOrigin: "http://127.0.0.1:8768",
    onError: error => assert.fail(error.message), notify: async () => {},
  });
  const id = bridge.add({ page: "/page", kind: "page", quote: "Page", comment: "a" }).id;
  bridge.update({ id: randomUUID(), commentId: id, reply: "done", resolved: true });
  const thread = bridge.list().find(c => c.id === id);
  assert.equal(thread.resolvedAt, thread.replies[0].at);
  await bridge.close();
  rmSync(directory, { recursive: true, force: true });
});

test("seen state is stored on the server and survives a restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "preview-comments-"));
  writeFileSync(join(directory, "page.md"), "# Page\n\nText.");
  const sessionId = randomUUID();
  const options = { sessionId, documentRoot: directory, storageRoot: directory, previewOrigin: "http://127.0.0.1:8769", onError: error => assert.fail(error.message), notify: async () => {} };
  const bridge = await startCommentBridge(options);
  const id = bridge.add({ page: "/page", kind: "page", quote: "Page", comment: "a" }).id;
  const call = async (bridgeInstance, path, body) => {
    const { port, token } = JSON.parse(readFileSync(bridgeInstance.connectionFile, "utf8"));
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}` }, body: body && JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await call(bridge, "/history")).body.seenInit, false);
  assert.equal((await call(bridge, "/userseen", { seen: { [id]: "root" } })).status, 200);
  assert.equal((await call(bridge, "/userseen", { seen: { "not-an-id": "x" } })).status, 400);
  await bridge.close();
  const again = await startCommentBridge(options);
  const history = (await call(again, "/history")).body;
  assert.equal(history.seenInit, true);
  assert.equal(history.comments[0].userSeen, "root");
  await again.close();
  rmSync(directory, { recursive: true, force: true });
});

test("comments addressed to other agents stay out of the owner's unread and are read per agent", async () => {
  const directory = mkdtempSync(join(tmpdir(), "preview-comments-"));
  writeFileSync(join(directory, "page.md"), "# Page\n\nText.");
  const sessionId = randomUUID();
  const bridge = await startCommentBridge({ sessionId, documentRoot: directory, storageRoot: directory, previewOrigin: "http://127.0.0.1:8770", onError: error => assert.fail(error.message), notify: async () => {} });
  const call = async (path, body) => {
    const { port, token } = JSON.parse(readFileSync(bridge.connectionFile, "utf8"));
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}` }, body: body && JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const post = (comment, to) => call("/comments", { id: randomUUID(), sessionId, url: "http://127.0.0.1:8770/page", section: "Page", kind: "page", quote: "Page", comment, ...(to ? { to } : {}) });
  assert.equal((await post("for owner")).status, 200);
  assert.equal((await post("for bob", ["bob"])).status, 200);
  assert.equal(bridge.pending().count, 1);
  assert.equal(bridge.pending("bob").count, 1);
  assert.equal((await call("/read?as=bob")).body.comments.map(c => c.comment).join(), "for bob");
  assert.equal(bridge.pending("bob").count, 0);
  assert.equal(bridge.pending().count, 1);
  assert.equal((await post("bad", ["no spaces"])).status, 400);
  assert.equal((await call("/settings", { owner: "alice", team: ["alice", "bob"], default: "last" })).body.default, "last");
  await bridge.close();
  rmSync(directory, { recursive: true, force: true });
});

test("without a hosting agent, the store's owner is told over the mesh too, including of unaddressed comments", async () => {
  const directory = mkdtempSync(join(tmpdir(), "preview-comments-"));
  const owner = randomUUID(), bob = randomUUID();
  writeFileSync(join(directory, "page.md"), "# Page\n\nText.");
  writeFileSync(join(directory, "team.md"), `| Who | Session |\n|---|---|\n| Owner | ${owner} |\n| Bob | ${bob} |\n`);
  for (const ownerViaMesh of [false, true]) {
    const sent = [];
    const bridge = await startCommentBridge({
      sessionId: owner, documentRoot: directory, storageRoot: join(directory, String(ownerViaMesh)), previewOrigin: "http://127.0.0.1:8770",
      onError: error => assert.fail(error.message), notify: async () => {}, ownerViaMesh,
      mesh: { send: async session => { sent.push(session); } },
    });
    const { port, token } = JSON.parse(readFileSync(bridge.connectionFile, "utf8"));
    for (const to of [undefined, ["owner"], ["bob"]]) {
      const response = await fetch(`http://127.0.0.1:${port}/comments`, { method: "POST", headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: randomUUID(), sessionId: owner, url: "http://127.0.0.1:8770/page", section: "Page", kind: "page", quote: "Page", comment: "hi", ...(to ? { to } : {}) }) });
      assert.equal(response.status, 200);
    }
    assert.deepEqual(sent, ownerViaMesh ? [owner, owner, bob] : [bob]);
    await bridge.close();
  }
  rmSync(directory, { recursive: true, force: true });
});

test("an agent's addressed thread and reply are announced to the others over the mesh, not to the sender", async () => {
  const directory = mkdtempSync(join(tmpdir(), "preview-comments-"));
  const owner = randomUUID(), bob = randomUUID(), carol = randomUUID();
  writeFileSync(join(directory, "page.md"), "# Page\n\nText.");
  writeFileSync(join(directory, "team.md"), `| Who | Session |\n|---|---|\n| Owner | ${owner} |\n| Bob | ${bob} |\n| Carol | ${carol} |\n`);
  const sent = [];
  const bridge = await startCommentBridge({
    sessionId: owner, documentRoot: directory, storageRoot: directory, previewOrigin: "http://127.0.0.1:8773",
    onError: error => assert.fail(error.message), notify: async () => {}, mesh: { send: async session => { sent.push(session); } },
  });
  const id = bridge.add({ page: "/page", kind: "page", quote: "Page", comment: "hi", to: ["bob", "carol"], from: "carol" }).id;
  assert.deepEqual(sent, [bob]);
  bridge.update({ id: randomUUID(), commentId: id, from: "bob", reply: "carol?" });
  assert.deepEqual(sent, [bob, carol]);
  bridge.update({ id: randomUUID(), commentId: id, from: "Carol", reply: "display name" });
  assert.deepEqual(sent, [bob, carol, bob]);
  bridge.update({ id: randomUUID(), commentId: id, from: "bob", reply: "psst", to: ["owner"], whisper: true });
  assert.deepEqual(bridge.read({ as: "carol", includeSeen: true }).flatMap(thread => thread.replies.map(r => r.comment)).includes("psst"), false);
  assert.deepEqual(bridge.read({ as: "owner", includeSeen: true }).flatMap(thread => thread.replies.map(r => r.comment)).includes("psst"), true);
  await bridge.close();
  rmSync(directory, { recursive: true, force: true });
});

test("an update accepts a unique 8-character thread id prefix, and blocked needs a reason", async () => {
  const dir = mkdtempSync(join(tmpdir(), "adr-prefix-"));
  writeFileSync(join(dir, "page.md"), "# Page\n\nBody text.\n");
  const bridge = await startCommentBridge({ sessionId: randomUUID(), documentRoot: dir, storageRoot: dir, previewOrigin: "http://127.0.0.1:5199", onError() {}, notify: async () => {} });
  try {
    const created = bridge.add({ page: "/page", kind: "page", quote: "Page", comment: "hi" });
    assert.ok(bridge.update({ id: randomUUID(), commentId: created.id.slice(0, 8), reply: "ok" }).saved);
    assert.throws(() => bridge.update({ id: randomUUID(), commentId: "00000000", reply: "ok" }), /does not exist/);
    assert.throws(() => bridge.setStatus({ state: "blocked", text: " " }), /reason/);
    assert.ok(bridge.setStatus({ state: "blocked", text: "need credentials" }).saved);
  } finally {
    await bridge.close();
    rmSync(dir, { recursive: true });
  }
});

test("the user's resolve is one mark among the addressees'; it closes when all have resolved, or for all on closeAll", async () => {
  const directory = mkdtempSync(join(tmpdir(), "preview-comments-"));
  writeFileSync(join(directory, "page.md"), "# Page\n\nText.");
  const sessionId = randomUUID();
  const bridge = await startCommentBridge({ sessionId, documentRoot: directory, storageRoot: directory, previewOrigin: "http://127.0.0.1:8771", onError: error => assert.fail(error.message), notify: async () => {} });
  const id = bridge.add({ page: "/page", kind: "page", quote: "Page", comment: "a" }).id;
  const thread = () => bridge.list().find(c => c.id === id);
  bridge.update({ id: randomUUID(), commentId: id, sessionId, reply: "hi", to: ["bob", "carol"] }, "user");
  bridge.update({ id: randomUUID(), commentId: id, sessionId, resolved: true, partial: true }, "user");
  assert.deepEqual([thread().resolved, Boolean(thread().resolvedBy.you)], [false, true]);
  bridge.update({ id: randomUUID(), commentId: id, from: "bob", resolved: true });
  assert.equal(thread().resolved, false);
  bridge.update({ id: randomUUID(), commentId: id, from: "carol", resolved: true });
  assert.equal(thread().resolved, true);
  bridge.update({ id: randomUUID(), commentId: id, sessionId, resolved: false }, "user");
  assert.deepEqual([thread().resolved, thread().resolvedBy], [false, undefined]);
  bridge.update({ id: randomUUID(), commentId: id, sessionId, resolved: true, closeAll: true }, "user");
  assert.equal(thread().resolved, true);
  bridge.update({ id: randomUUID(), commentId: id, sessionId, resolved: false }, "user");
  bridge.update({ id: randomUUID(), commentId: id, sessionId, resolved: true, partial: true }, "user");
  bridge.update({ id: randomUUID(), commentId: id, sessionId, resolved: false, partial: true }, "user");
  assert.deepEqual([thread().resolved, thread().resolvedBy.you], [false, undefined], "unresolving clears only your own mark");
  bridge.update({ id: randomUUID(), commentId: id, from: "bob", resolved: true });
  bridge.update({ id: randomUUID(), commentId: id, sessionId, reply: "bob, one more thing", to: ["bob", "carol"] }, "user");
  assert.equal(thread().resolvedBy?.bob, undefined, "addressing someone who resolved clears their mark");
  bridge.update({ id: randomUUID(), commentId: id, sessionId, resolved: false }, "user");
  bridge.update({ id: randomUUID(), commentId: id, sessionId, resolved: true }, "user");
  assert.equal(thread().resolved, true, "a record without partial (as in old logs) still closes for all");
  await bridge.close();
  rmSync(directory, { recursive: true, force: true });
});

test("threads.json keeps a thread whose addressee answered but has not resolved, so it stays in their queue", async () => {
  const directory = mkdtempSync(join(tmpdir(), "preview-comments-"));
  writeFileSync(join(directory, "page.md"), "# Page\n\nText.");
  writeFileSync(join(directory, "queues.json"), "{}");
  const sessionId = randomUUID();
  const bridge = await startCommentBridge({ sessionId, documentRoot: directory, storageRoot: directory, previewOrigin: "http://127.0.0.1:8772", onError: error => assert.fail(error.message), notify: async () => {} });
  const id = bridge.add({ page: "/page", kind: "page", quote: "Page", comment: "a" }).id;
  bridge.update({ id: randomUUID(), commentId: id, sessionId, reply: "bob?", to: ["bob"] }, "user");
  await new Promise(done => setTimeout(done, 20));
  bridge.update({ id: randomUUID(), commentId: id, from: "bob", reply: "answered" });
  await new Promise(done => setTimeout(done, 2200));
  const rows = JSON.parse(readFileSync(join(directory, "threads.json"), "utf8"));
  assert.deepEqual(rows.map(row => [row.answered_by, row.unresolved_by]), [[["bob"], ["bob"]]]);
  bridge.update({ id: randomUUID(), commentId: id, from: "bob", resolved: true });
  await new Promise(done => setTimeout(done, 2200));
  assert.deepEqual(JSON.parse(readFileSync(join(directory, "threads.json"), "utf8")), []);
  await bridge.close();
  rmSync(directory, { recursive: true, force: true });
});
