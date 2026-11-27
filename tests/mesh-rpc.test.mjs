import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { ALLOWED, decodeResponse, encodeResponse, fitResponse, parseResponse } from "../src/mesh-rpc.mjs";

test("a response larger than one mesh message is chunked and reassembled", () => {
  const payload = { status: 200, body: { text: randomBytes(20_000).toString("hex") } };
  const messages = encodeResponse("abc", payload);
  assert.ok(messages.length > 1 && messages.every(content => Buffer.byteLength(content) < 10_240));
  const parts = messages.map(parseResponse).reverse().sort((a, b) => a.part - b.part);
  assert.deepEqual(decodeResponse(parts.map(part => part.data)), payload);
});

test("a large read of repetitive comments fits in few chunks, within the mesh's per-pair send limit", () => {
  const comments = Array.from({ length: 600 }, (_, i) => ({ id: `c${i}`, comment: "A typical review comment about the plan. ".repeat(12), replies: [{ author: "agent", reply: "Done, see the page." }] }));
  const messages = encodeResponse("big", { status: 200, body: { comments } });
  assert.ok(messages.length <= 8, `${messages.length} chunks`);
  assert.deepEqual(decodeResponse(messages.map(parseResponse).map(part => part.data)).body.comments, comments);
});

test("only the bridge's agent endpoints are served over the mesh", () => {
  assert.ok(ALLOWED.test("/read?as=x") && ALLOWED.test("/agent-update"));
  assert.ok(!ALLOWED.test("/stop") && !ALLOWED.test("/readme") && !ALLOWED.test("/../read"));
});

test("a read too large for the mesh is shortened to fit, keeping each thread's latest replies", () => {
  const words = () => randomBytes(3000).toString("hex");
  const comments = Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, comment: words(), input: { big: words() }, replies: Array.from({ length: 12 }, (_, n) => ({ n, reply: words() })) }));
  const payload = { status: 200, body: { comments } };
  assert.ok(encodeResponse("x", payload).length > 8);
  const fitted = fitResponse(payload);
  assert.ok(encodeResponse("x", fitted).length <= 8);
  assert.equal(fitted.body.comments.length, 40);
  assert.ok(fitted.body.comments[0].replies.at(-1).n === 11 || fitted.body.comments[0].replies.length === 0);
  assert.match(fitted.body.trimmed, /Shortened/);
  const small = { status: 200, body: { comments: [{ id: "a", replies: [] }] } };
  assert.equal(fitResponse(small), small);
});
