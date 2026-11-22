import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { applyVote, refreshQueue, requestVotes, reveal, voteQueue, readVotes } from "../src/votes.mjs";

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
    assert.deepEqual(key(late), ["b:Vote on t", "owner1:Close t on the votes in (1 of 2)"]);
    assert.equal(refreshQueue(root), false);
    applyVote(root, { page: "/p", item: "t", agent: "b", vote: 3 });
    assert.deepEqual(key(queue()), ["owner1:Reveal t"]);
    reveal(root, { page: "/p", item: "t" });
    assert.deepEqual(queue(), []);
    assert.throws(() => requestVotes(root, { page: "/p", item: "u", voters: [] }), /1 to 12/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
