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

test("queue items are attributed by id from this interaction only, with the event as proof", () => {
  const items = [{ id: "piadapter", kind: "test", test: "pi adapter" }, { id: "thread-716db4bb", kind: "thread", test: "t" }, { id: "x", kind: "test" }];
  const lines = [
    ev("user.message", "2026-11-20T09:00:00Z", { content: "start piadapter" }),
    ev("assistant.turn_start", "2026-11-20T09:00:01Z"),
    ev("user.message", "2026-11-20T09:59:00Z", { content: "look at thread 716db4bb" }),
    ev("assistant.turn_start", "2026-11-20T09:59:01Z"),
    ev("tool.execution_start", "2026-11-20T09:59:02Z", { toolCallId: "a", toolName: "bash", arguments: { command: "echo 716db4bb-d3db" } }, "evt1"),
  ];
  const { workingOn } = deriveState(lines, now, items);
  assert.deepEqual(workingOn.map(w => w.id), ["thread-716db4bb"]);
  assert.equal(workingOn[0].eventId, "evt1");
});

test("itemTurns maps each item to the first interaction naming it and counts the rest as unmapped", async () => {
  const { itemTurns } = await import("../src/verified-state.mjs");
  const line = (type, id, data) => JSON.stringify({ type, id, timestamp: "2026-11-20T10:00:00Z", data });
  const lines = [
    line("user.message", "e1", { content: "start" }),
    line("user.message", "e2", { content: "please do thread 3b9aec6d now" }),
    line("tool.execution_start", "e3", { toolName: "bash", arguments: { command: "work on harness-field" } }),
  ];
  const result = itemTurns(lines, [{ id: "thread-3b9aec6d", kind: "thread", test: "t" }, { id: "harness-field", test: "h" }, { id: "hash-chain", test: "c" }]);
  assert.deepEqual(result.items.map(row => [row.interaction, row.via]), [[2, "told"], [2, "acted"], [null, undefined]]);
  assert.equal(result.unmapped, 1);
});
