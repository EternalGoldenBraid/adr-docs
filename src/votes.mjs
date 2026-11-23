import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Effort votes live in <site root>/votes.json: [{page, item, owner?, weight?, decidedAt?, rounds: [{round, votes, notes, ownerReply, revealed, mean, variance, converged}]}].
// Fibonacci scale; a round has converged when its highest and lowest vote are within one step; the weight is the median (the higher value on an even count).
export const SCALE = [1, 2, 3, 5, 8, 13, 21];

export const stats = votes => {
  const values = Object.values(votes).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length) return {};
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const median = values[Math.floor(values.length / 2)];
  const step = value => SCALE.indexOf(value);
  const converged = step(values.at(-1)) - step(values[0]) <= 1;
  return { mean: +mean.toFixed(2), variance: +variance.toFixed(2), median, converged, min: values[0], max: values.at(-1) };
};

const file = root => join(root, "votes.json");
export const readVotes = root => {
  try { return existsSync(file(root)) ? JSON.parse(readFileSync(file(root), "utf8")) : []; } catch { return []; }
};
const save = (root, items) => {
  const tmp = file(root) + ".tmp";
  writeFileSync(tmp, JSON.stringify(items, null, 1) + "\n"); renameSync(tmp, file(root));
  const queue = file(root).replace(/votes\.json$/, "votes-queue.json"), queueTmp = queue + ".tmp";
  writeFileSync(queueTmp, JSON.stringify(voteQueue(items), null, 1) + "\n"); renameSync(queueTmp, queue);
};

const find = (items, page, item) => items.find(row => row.page === page && row.item === item);
const open = row => row.rounds.find(round => !round.revealed);
// A round decides or closes only with 3 votes (fewer when fewer than 3 voters were asked).
export const QUORUM = 3;
const quorum = round => Math.min(QUORUM, round.requested?.length ?? QUORUM);

// Operations; each returns the updated item. A vote goes into the open round (a new item or a revealed round starts a new one).
export function applyVote(root, { page, item, agent, vote, owner }) {
  if (!SCALE.includes(Number(vote))) throw new Error(`Vote must be one of ${SCALE.join(", ")}.`);
  const items = readVotes(root);
  const row = find(items, page, item) ?? (items.push({ page, item, ...(owner ? { owner } : {}), rounds: [] }), items.at(-1));
  if (owner) row.owner = owner;
  if (row.decidedAt) throw new Error("This item is decided; start a new item name for another vote.");
  if (!open(row)) row.rounds.push({ round: row.rounds.length + 1, votes: {} });
  open(row).votes[agent] = Number(vote);
  save(root, items);
  return row;
}

// A request names who must vote; the open round remembers it. A voter's item ends when they vote; the requester gets one item
// when the last vote is in, or, after the deadline, one to close on the votes that came.
export function requestVotes(root, { page, item, voters, requester, closeTo, deadlineMinutes = 5, reopen: again, now = new Date() }) {
  const names = [...new Set((voters ?? []).map(String))].filter(Boolean);
  if (!names.length || names.length > 12) throw new Error("Name 1 to 12 voters.");
  const items = readVotes(root);
  const row = find(items, page, item) ?? (items.push({ page, item, rounds: [] }), items.at(-1));
  if (row.decidedAt && again) delete row.decidedAt, delete row.weight;
  if (row.decidedAt) throw new Error("This item is decided; reopen it (reopen: true) or start a new item name for another vote.");
  if (!open(row)) row.rounds.push({ round: row.rounds.length + 1, votes: {} });
  Object.assign(open(row), { requested: names, requestedBy: requester ?? row.owner ?? "owner", requestedAt: now.toISOString(), deadlineMinutes: Math.max(1, Math.min(1440, Number(deadlineMinutes) || 5)), closeTo: closeTo || "site-manager", closeNotified: false });
  save(root, items);
  return row;
}

export function voteQueue(items, now = new Date()) {
  const out = [];
  for (const row of items) {
    const round = row.decidedAt ? undefined : open(row);
    if (!round?.requested) continue;
    const missing = round.requested.filter(name => round.votes[name] === undefined);
    const base = { page: row.page, item: row.item, round: round.round };
    for (const name of missing) out.push({ ...base, to: name, rank: 0, text: `Vote on ${row.item}` });
    const late = now - Date.parse(round.requestedAt) > round.deadlineMinutes * 60000;
    if (!missing.length) out.push({ ...base, to: round.requestedBy, rank: 0, text: `Reveal ${row.item}` });
    else if (late && Object.keys(round.votes).length >= quorum(round)) out.push({ ...base, to: round.requestedBy, rank: 0, text: `Close ${row.item} on the votes in (${Object.keys(round.votes).length} of ${round.requested.length})` });
  }
  return out;
}

// Rounds whose window has closed (everyone voted, or the deadline passed) and whose lead has not been told; marks them told.
export function dueCloseNotices(root, now = new Date()) {
  const items = readVotes(root), due = [];
  for (const row of items) {
    const round = row.decidedAt ? undefined : open(row);
    if (!round?.requested || round.closeNotified) continue;
    const missing = round.requested.filter(name => round.votes[name] === undefined);
    if (missing.length && (now - Date.parse(round.requestedAt) <= round.deadlineMinutes * 60000)) continue;
    round.closeNotified = true;
    due.push({ page: row.page, item: row.item, round: round.round, to: round.closeTo ?? "site-manager", voted: Object.keys(round.votes), missing, requestedBy: round.requestedBy, short: Object.keys(round.votes).length < quorum(round) });
  }
  if (due.length) save(root, items);
  return due;
}

// Rewrites votes-queue.json when only time has changed it (a deadline passed); returns whether it did.
export function refreshQueue(root) {
  const items = readVotes(root);
  if (!items.some(row => open(row)?.requested)) return false;
  const queue = file(root).replace(/votes\.json$/, "votes-queue.json"), text = JSON.stringify(voteQueue(items), null, 1) + "\n";
  try { if (readFileSync(queue, "utf8") === text) return false; } catch { /* not written yet */ }
  writeFileSync(queue + ".tmp", text); renameSync(queue + ".tmp", queue);
  return true;
}

// Below the quorum a reveal needs force, and never decides the item.
export function reveal(root, { page, item, force }) {
  const items = readVotes(root), row = find(items, page, item), round = row && open(row);
  if (!round) throw new Error("No open round to reveal.");
  const votes = Object.keys(round.votes).length, short = votes < quorum(round);
  if (short && !force) throw new Error(`Only ${votes} of the ${quorum(round)} votes needed are in; the round stays open (force: true reveals without deciding).`);
  Object.assign(round, { revealed: true }, stats(round.votes));
  if (round.converged && !short) { row.weight = round.median; row.decidedAt = new Date().toISOString(); }
  save(root, items);
  return row;
}

// Takes a decided item back to voting: the weight is cleared and the next vote or request opens a new round.
export function reopen(root, { page, item }) {
  const items = readVotes(root), row = find(items, page, item);
  if (!row) throw new Error("Unknown item.");
  delete row.decidedAt, delete row.weight;
  save(root, items);
  return row;
}

// A min/max justification (agent) or the owner's single reply before the revote (as: "owner").
export function addNote(root, { page, item, agent, text, as }) {
  const items = readVotes(root), row = find(items, page, item);
  const round = row && (open(row) ?? row.rounds.at(-1));
  if (!round) throw new Error("Unknown item.");
  if (as === "owner") round.ownerReply = text; else (round.notes ??= {})[agent] = text;
  save(root, items);
  return row;
}

// What readers see: votes stay private until the round is revealed (only who has voted is shown).
export const publicVotes = items => items.map(row => ({
  ...row,
  rounds: row.rounds.map(round => round.revealed ? round : { round: round.round, voted: Object.keys(round.votes), votes: {} }),
}));
