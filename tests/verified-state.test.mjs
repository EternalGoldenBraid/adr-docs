import assert from "node:assert/strict";
import test from "node:test";
import { deriveState, disagrees } from "../src/verified-state.mjs";

const ev = (type, timestamp, data = {}, id = `${type}-${timestamp}`) => JSON.stringify({ type, timestamp, id, data });
const now = Date.parse("2026-11-20T10:00:00Z");

test("an open turn with a running tool is working, and noise events are ignored", () => {
  const state = deriveState([ev("assistant.turn_start", "2026-11-20T09:59:50Z"), ev("tool.execution_start", "2026-11-20T09:59:55Z", { toolCallId: "a", toolName: "bash" }), ev("hook.end", "2026-11-20T09:59:59Z")], now);
  assert.equal(state.state, "working");
  assert.equal(state.detail, "tool: bash");
  assert.equal(state.eventType, "tool.execution_start");
});

test("a finished turn is idle, an unanswered permission is asking, a silent open turn is stalled", () => {
  assert.equal(deriveState([ev("assistant.turn_start", "2026-11-20T09:50:00Z"), ev("assistant.turn_end", "2026-11-20T09:50:05Z")], now).state, "idle");
  assert.equal(deriveState([ev("assistant.turn_start", "2026-11-20T09:59:00Z"), ev("permission.requested", "2026-11-20T09:59:30Z", { requestId: "p" })], now).state, "asking");
  assert.equal(deriveState(["{cut", ev("assistant.turn_start", "2026-11-20T09:30:00Z")], now).state, "stalled");
});

test("a claim that contradicts the log is flagged", () => {
  const working = { state: "working", ageMs: 1000 }, idle = { state: "idle", ageMs: 600_000 };
  assert.equal(disagrees("idle", working), true);
  assert.equal(disagrees("running", idle), true);
  assert.equal(disagrees("running", working), false);
});
