// What a Copilot session is doing, read from its own append-only event log (events.jsonl), not from what the agent says.
// Every event carries an id and a parentId, so the last event id is a checkable pointer into the log.
const NOISE = /^(hook\.|session\.usage|session\.info|system\.|model\.)/;
const STALLED_MS = 10 * 60_000;

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// A queue item counts as touched when its id (or, for a thread item, its 8-character thread id) appears in what the agent was told or did.
function needleFor(item) {
  const id = String(item.id ?? "");
  const bare = item.kind === "thread" ? id.replace(/^thread-/, "") : id;
  return bare.length >= 5 ? new RegExp(`(?<![\\w-])${escape(bare)}(?!\\w)`, "i") : null;
}

export function deriveState(lines, now = Date.now(), items = []) {
  let turn = false, last = null, turnEnded = null;
  const needles = items.map(item => [item, needleFor(item)]).filter(([, needle]) => needle);
  const touched = new Map();
  const mention = (event, text) => {
    for (const [item, needle] of needles) if (needle.test(text)) touched.set(item.id, { id: item.id, test: item.test, eventId: event.id, at: event.timestamp });
  };
  const tools = new Map();
  const permissions = new Set();
  for (const line of lines) {
    let event;
    try { event = JSON.parse(line); } catch { continue; } // a tail read can cut the first line
    const { type, data = {} } = event;
    if (!type || NOISE.test(type)) continue;
    last = event;
    // The window is the current interaction: everything since the last user message.
    if (type === "user.message") touched.clear();
    if (type === "user.message" || type === "tool.execution_start") mention(event, JSON.stringify(type === "user.message" ? data.content ?? data : data.arguments ?? {}));
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
  const evidence = { eventId: last.id, eventType: last.type, at: last.timestamp, workingOn: [...touched.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3) };
  if (permissions.size) return { state: "asking", detail: "permission prompt", ...evidence, ageMs };
  if (turn) {
    const tool = [...tools.values()].at(-1);
    return { state: ageMs > STALLED_MS ? "stalled" : "working", detail: tool ? `tool: ${tool}` : "thinking", ...evidence, ageMs };
  }
  return { state: "idle", detail: "", ...evidence, ageMs, idleSince: turnEnded ?? last.timestamp };
}

// Each queue item mapped to the first interaction (user message number, counting from 1) in which its id appears in what the agent was told or did.
// Items that never appear map to none; `unmapped` is that share of the items, the measure of how reliable id matching is.
export function itemTurns(lines, items) {
  const needles = items.map(item => [item, needleFor(item)]);
  const found = new Map();
  let interaction = 0;
  for (const line of lines) {
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    const { type, data = {} } = event;
    if (type === "user.message") interaction += 1;
    if (type !== "user.message" && type !== "tool.execution_start") continue;
    const text = JSON.stringify(type === "user.message" ? data.content ?? data : data.arguments ?? {});
    for (const [item, needle] of needles) if (needle && !found.has(item.id) && needle.test(text)) found.set(item.id, { interaction, eventId: event.id, at: event.timestamp, via: type === "user.message" ? "told" : "acted" });
  }
  const mapped = items.map(item => ({ id: item.id, test: item.test, state: item.state, ...(found.get(item.id) ?? { interaction: null }) }));
  const none = mapped.filter(row => row.interaction === null).length;
  return { items: mapped, mapped: mapped.length - none, unmapped: none, unmappedShare: mapped.length ? Math.round(none / mapped.length * 100) / 100 : 0 };
}

// A claim (the agent's STATUS line) contradicts the log when it says free while a turn is open, or busy while the log has been idle for a while.
export function disagrees(claimState, verified, graceMs = 2 * 60_000) {
  if (!claimState || !verified) return false;
  const busyClaim = ["running", "working"].includes(claimState);
  const freeClaim = ["idle", "done"].includes(claimState);
  if (freeClaim && ["working", "asking"].includes(verified.state)) return true;
  return busyClaim && verified.state === "idle" && verified.ageMs > graceMs;
}
