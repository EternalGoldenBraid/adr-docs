// What a Copilot session is doing, read from its own append-only event log (events.jsonl), not from what the agent says.
// Every event carries an id and a parentId, so the last event id is a checkable pointer into the log.
const NOISE = /^(hook\.|session\.usage|session\.info|system\.|model\.)/;
const STALLED_MS = 10 * 60_000;

export function deriveState(lines, now = Date.now()) {
  let turn = false, last = null, turnEnded = null;
  const tools = new Map();
  const permissions = new Set();
  for (const line of lines) {
    let event;
    try { event = JSON.parse(line); } catch { continue; } // a tail read can cut the first line
    const { type, data = {} } = event;
    if (!type || NOISE.test(type)) continue;
    last = event;
    if (type === "assistant.turn_start") turn = true;
    else if (type === "assistant.turn_end") { turn = false; turnEnded = event.timestamp; tools.clear(); permissions.clear(); }
    else if (type === "tool.execution_start") tools.set(data.toolCallId ?? event.id, data.toolName ?? "tool");
    else if (type === "tool.execution_complete") tools.delete(data.toolCallId);
    else if (type === "permission.requested") permissions.add(data.requestId ?? event.id);
    else if (type === "permission.completed") permissions.delete(data.requestId);
    else if (type === "user.message") turn = true;
  }
  if (!last) return null;
  const at = Date.parse(last.timestamp);
  const ageMs = Math.max(0, now - at);
  const evidence = { eventId: last.id, eventType: last.type, at: last.timestamp };
  if (permissions.size) return { state: "asking", detail: "permission prompt", ...evidence, ageMs };
  if (turn) {
    const tool = [...tools.values()].at(-1);
    return { state: ageMs > STALLED_MS ? "stalled" : "working", detail: tool ? `tool: ${tool}` : "thinking", ...evidence, ageMs };
  }
  return { state: "idle", detail: "", ...evidence, ageMs, idleSince: turnEnded ?? last.timestamp };
}

// A claim (the agent's STATUS line) contradicts the log when it says free while a turn is open, or busy while the log has been idle for a while.
export function disagrees(claimState, verified, graceMs = 2 * 60_000) {
  if (!claimState || !verified) return false;
  const busyClaim = ["running", "working"].includes(claimState);
  const freeClaim = ["idle", "done"].includes(claimState);
  if (freeClaim && ["working", "asking"].includes(verified.state)) return true;
  return busyClaim && verified.state === "idle" && verified.ageMs > graceMs;
}
