import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { ALLOWED, decodeResponse, encodeResponse, parseResponse } from "../src/mesh-rpc.mjs";

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
