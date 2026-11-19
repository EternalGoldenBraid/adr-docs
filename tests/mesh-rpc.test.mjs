import assert from "node:assert/strict";
import test from "node:test";
import { ALLOWED, decodeResponse, encodeResponse, parseResponse } from "../src/mesh-rpc.mjs";

test("a response larger than one mesh message is chunked and reassembled", () => {
  const payload = { status: 200, body: { text: "é".repeat(20_000) } };
  const messages = encodeResponse("abc", payload);
  assert.ok(messages.length > 1 && messages.every(content => Buffer.byteLength(content) < 10_240));
  const parts = messages.map(parseResponse).reverse().sort((a, b) => a.part - b.part);
  assert.deepEqual(decodeResponse(parts.map(part => part.data)), payload);
});

test("only the bridge's agent endpoints are served over the mesh", () => {
  assert.ok(ALLOWED.test("/read?as=x") && ALLOWED.test("/agent-update"));
  assert.ok(!ALLOWED.test("/stop") && !ALLOWED.test("/readme") && !ALLOWED.test("/../read"));
});
