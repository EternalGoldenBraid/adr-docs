import test from "node:test";
import assert from "node:assert/strict";
import { needsVerdict } from "../src/page-tree.mjs";

const done = "---\ncard-status: shipped\n---\n# T\n";

test("a finished page needs non-empty Verdict and Learnings sections", () => {
  assert.equal(needsVerdict(done), true);
  assert.equal(needsVerdict(`${done}## Verdict\n\n## Learnings\nx\n`), true);
  assert.equal(needsVerdict(`${done}## Verdict\nok\n## Learnings\nx\n`), true);
  assert.equal(needsVerdict(`---\ncard-status: shipped\nverdict:\n  result: supported\n  claim: holds\n  confidence: confirmed\n---\n# T\n## Learnings\nx\n`), false);
});

test("an unfinished page is never flagged", () => {
  assert.equal(needsVerdict("---\ncard-status: building\n---\n# T\n"), false);
});

test("cards list each card-test with its status and date", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pageCards } = await import("../src/page-tree.mjs");
  const dir = mkdtempSync(join(tmpdir(), "cards-"));
  writeFileSync(join(dir, "a.md"), "---\ncard-line: x\ncard-test: Stage 1 | done | 2026-11-19\ncard-test: Stage 2 | running\n---\n# A\n");
  assert.deepEqual(pageCards(dir)["/a"].tests, [{ name: "Stage 1", status: "done", at: "2026-11-19" }, { name: "Stage 2", status: "running" }]);
});

test("the nested card: block gives the line, badge and tests", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pageCards } = await import("../src/page-tree.mjs");
  const dir = mkdtempSync(join(tmpdir(), "cards-"));
  writeFileSync(join(dir, "b.md"), "---\ncard:\n  gist: \"Why?\"\n  state: planned\n  owner: PC lead\n  tests:\n    - {name: \"Run 1\", state: running, date: 2026-11-19}\nstatus: running\n---\n# B\n");
  const card = pageCards(dir)["/b"];
  assert.deepEqual([card.line, card.status, card.owner, card.tests], ["Why?", "running", "PC lead", [{ name: "Run 1", status: "running", at: "2026-11-19" }]]);
});

test("a card test keeps a #heading or site-path link and drops anything else", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pageCards } = await import("../src/page-tree.mjs");
  const dir = mkdtempSync(join(tmpdir(), "link-"));
  writeFileSync(join(dir, "l.md"), "---\ncard:\n  gist: \"G\"\n  state: planned\n  tests:\n    - {name: \"A\", link: \"#first-result\", state: done}\n    - {name: \"B\", link: \"/other#x\", state: done}\n    - {name: \"C\", link: \"javascript:alert(1)\", state: done}\n---\n# L\n");
  assert.deepEqual(pageCards(dir)["/l"].tests.map(t => t.link), ["#first-result", "/other#x", undefined]);
});

test("a test's result file drives its state and the page state is derived", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pageCards } = await import("../src/page-tree.mjs");
  const dir = mkdtempSync(join(tmpdir(), "res-"));
  writeFileSync(join(dir, "r.json"), '{"status":"failed","finished_at":"2026-11-19T10:00:00Z"}');
  writeFileSync(join(dir, "c.md"), "---\ncard:\n  state: planned\n  tests:\n    - {name: \"A\", state: running, result: r.json}\n    - {name: \"B\", state: done}\n---\n# C\n");
  const card = pageCards(dir)["/c"];
  assert.deepEqual([card.status, card.tests[0].status, card.tests[0].at, card.statusMismatch], ["failed", "failed", "2026-11-19", "planned"]);
});

test("a card without an owner lists the missing mandatory fields", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pageCards } = await import("../src/page-tree.mjs");
  const dir = mkdtempSync(join(tmpdir(), "miss-"));
  writeFileSync(join(dir, "m.md"), "---\ncard:\n  gist: \"Why\"\n  state: planned\n---\n# M\n");
  assert.deepEqual(pageCards(dir)["/m"].missing, ["owner"]);
});

test("page front-matter owner becomes the card owner", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pageCards } = await import("../src/page-tree.mjs");
  const dir = mkdtempSync(join(tmpdir(), "own-"));
  writeFileSync(join(dir, "o.md"), "---\nowner: pc-lead\ncard:\n  gist: \"G\"\n  state: planned\n---\n# O\n");
  assert.equal(pageCards(dir)["/o"].owner, "pc-lead");
});

test("slugs drop accents instead of the letter, and keep the old form as an alias", async () => {
  const { slugify, legacySlug } = await import("../src/roster.mjs");
  assert.deepEqual([slugify("Mökki agent"), legacySlug("Mökki agent")], ["mokki-agent", "m-kki-agent"]);
});

test("effort votes: reveal gives mean, variance, convergence and the median weight; unrevealed votes stay private", async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { applyVote, reveal, publicVotes, readVotes } = await import("../src/votes.mjs");
  const dir = mkdtempSync(join(tmpdir(), "votes-"));
  for (const [agent, vote] of [["a", 1], ["b", 1], ["c", 3], ["d", 2]]) applyVote(dir, { page: "/p", item: "A", agent, vote });
  assert.deepEqual(publicVotes(readVotes(dir))[0].rounds[0], { round: 1, voted: ["a", "b", "c", "d"], votes: {} });
  const first = reveal(dir, { page: "/p", item: "A" }).rounds[0];
  assert.deepEqual([first.mean, first.converged, first.median], [1.75, false, 2]);
  assert.throws(() => applyVote(dir, { page: "/p", item: "A", agent: "a", vote: 4 }), /Fibonacci|must be one of/);
  for (const [agent, vote] of [["a", 1], ["b", 1], ["c", 2], ["d", 2]]) applyVote(dir, { page: "/p", item: "A", agent, vote });
  assert.equal(reveal(dir, { page: "/p", item: "A" }).weight, 2);
});

test("front-matter verdict and a 'What we learned' section satisfy a finished page", () => {
  assert.equal(needsVerdict("---\nstatus: done\nverdict:\n  result: inconclusive\n  claim: stable at 0.012\n  confidence: hypothesis\n---\n# T\n## What we learned\nx\n"), false);
  assert.equal(needsVerdict("---\nstatus: done\nverdict: stable at 0.012\n---\n# T\n## What we learned\nx\n"), true);
});

test("a done page without a structured verdict is held in review as blocked by the verdict", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pageCards } = await import("../src/page-tree.mjs");
  const dir = mkdtempSync(join(tmpdir(), "cards-"));
  writeFileSync(join(dir, "d.md"), "---\nowner: lead\nquestion: Q?\nverdict: fine\ncard:\n  tests:\n    - {name: \"Run 1\", state: done}\n---\n# D\n");
  const card = pageCards(dir)["/d"];
  assert.deepEqual([card.status, card.blockedBy], ["review", ["verdict"]]);
});

test("a finished page with open threads is in review until they are resolved", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pageCards } = await import("../src/page-tree.mjs");
  const dir = mkdtempSync(join(tmpdir(), "cards-"));
  writeFileSync(join(dir, "c.md"), "---\nowner: lead\nquestion: Does it hold?\nverdict:\n  result: supported\n  claim: holds\n  confidence: confirmed\ncard:\n  tests:\n    - {name: \"Run 1\", state: done}\n---\n# C\n");
  assert.deepEqual([pageCards(dir)["/c"].status, pageCards(dir)["/c"].line], ["done", "Does it hold?"]);
  writeFileSync(join(dir, "threads.json"), JSON.stringify([{ id: "t1", page: "/c.html", addressees: ["lead"], answered_by: [], at: "x" }]));
  const card = pageCards(dir)["/c"];
  assert.deepEqual([card.status, card.openThreads], ["done", 1]);
  writeFileSync(join(dir, "t.md"), "---\nstatus: todo\ncard:\n  gist: An idea\n---\n# T\n");
  assert.equal(pageCards(dir)["/t"].status, "todo");
  writeFileSync(join(dir, "v.md"), "---\nvoted: false\ncard:\n  gist: Planned\n---\n# V\n");
  assert.equal(pageCards(dir)["/v"].voted, false);
});
