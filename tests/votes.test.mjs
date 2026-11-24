import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { applyVote, dueCloseNotices, refreshQueue, requestVotes, reveal, voteQueue, readVotes } from "../src/votes.mjs";

test("a vote request queues one item per voter, then one reveal item for the requester, or a close item after the deadline", () => {
  const root = mkdtempSync(join(tmpdir(), "adr-votes-"));
  try {
    const queue = () => JSON.parse(readFileSync(join(root, "votes-queue.json"), "utf8"));
    const key = q => q.map(x => `${x.to}:${x.text}`).sort();
    requestVotes(root, { page: "/p", item: "t", voters: ["a", "b"], requester: "owner1", deadlineMinutes: 30 });
    assert.deepEqual(key(queue()), ["a:Vote on t", "b:Vote on t"]);
    applyVote(root, { page: "/p", item: "t", agent: "a", vote: 3 });
    assert.deepEqual(key(queue()), ["b:Vote on t"]);
    const late = voteQueue(readVotes(root), new Date(Date.now() + 3600e3));
    assert.deepEqual(key(late), ["b:Vote on t"]);
    assert.equal(refreshQueue(root), false);
    applyVote(root, { page: "/p", item: "t", agent: "b", vote: 3 });
    assert.deepEqual(key(queue()), ["owner1:Reveal t"]);
    reveal(root, { page: "/p", item: "t" });
    assert.deepEqual(queue(), []);
    assert.throws(() => requestVotes(root, { page: "/p", item: "u", voters: [] }), /1 to 12/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the lead is told once when the window closes, early when everyone has voted", () => {
  const root = mkdtempSync(join(tmpdir(), "adr-votes-"));
  try {
    requestVotes(root, { page: "/p", item: "t", voters: ["a", "b"], requester: "owner1" });
    assert.deepEqual(dueCloseNotices(root), []);
    const late = dueCloseNotices(root, new Date(Date.now() + 6 * 60e3));
    assert.deepEqual(late.map(d => [d.to, d.missing]), [["site-manager", ["a", "b"]]]);
    assert.deepEqual(dueCloseNotices(root, new Date(Date.now() + 9 * 60e3)), []);
    requestVotes(root, { page: "/p", item: "u", voters: ["a"], requester: "owner1", closeTo: "lead" });
    applyVote(root, { page: "/p", item: "u", agent: "a", vote: 2 });
    assert.deepEqual(dueCloseNotices(root).map(d => [d.item, d.to]), [["u", "lead"]]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a round needs 3 votes to close or decide; a decided item can be reopened", () => {
  const root = mkdtempSync(join(tmpdir(), "adr-votes-"));
  try {
    const ask = extra => requestVotes(root, { page: "/p", item: "t", voters: ["a", "b", "c", "d"], requester: "o", ...extra });
    ask();
    applyVote(root, { page: "/p", item: "t", agent: "a", vote: 3 });
    const late = new Date(Date.now() + 6 * 60e3);
    assert.deepEqual(dueCloseNotices(root, late).map(d => d.short), [true]);
    assert.throws(() => reveal(root, { page: "/p", item: "t" }), /Only 1 of the 3/);
    assert.equal(reveal(root, { page: "/p", item: "t", force: true }).decidedAt, undefined);
    ask();
    for (const agent of ["a", "b", "c"]) applyVote(root, { page: "/p", item: "t", agent, vote: 2 });
    assert.deepEqual(dueCloseNotices(root, late).map(d => d.short), [false]);
    assert.equal(reveal(root, { page: "/p", item: "t" }).weight, 2);
    assert.throws(() => ask(), /reopen/);
    assert.equal(ask({ reopen: true }).weight, undefined);
    assert.equal(readVotes(root)[0].rounds.at(-1).votes.a, undefined);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a vote can state its precision; it is hidden until the reveal", async () => {
  const { publicVotes } = await import("../src/votes.mjs");
  const root = mkdtempSync(join(tmpdir(), "adr-votes-"));
  try {
    applyVote(root, { page: "/p", item: "p", agent: "a", vote: 3, precision: "high" });
    applyVote(root, { page: "/p", item: "p", agent: "b", vote: 5, precision: "low" });
    applyVote(root, { page: "/p", item: "p", agent: "c", vote: 5 });
    assert.throws(() => applyVote(root, { page: "/p", item: "p", agent: "d", vote: 5, precision: "medium" }), /Precision must be/);
    assert.deepEqual(publicVotes(readVotes(root))[0].rounds[0].precision, undefined);
    reveal(root, { page: "/p", item: "p" });
    assert.deepEqual(publicVotes(readVotes(root))[0].rounds[0].precision, { a: "high", b: "low" });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
