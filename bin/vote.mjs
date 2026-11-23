#!/usr/bin/env node
// adr-vote [--root DIR] <page> <item> <agent> <n>        cast a vote (Fibonacci 1 2 3 5 8 13 21)
// adr-vote [--root DIR] --as AGENT --page PAGE item=score ...   cast several votes at once, e.g. maplevels=5 mapnav=3
// adr-vote [--root DIR] --request <page> <item> --voters a,b [--as requester] [--deadline MIN]   put "Vote on" in each voter's queue (votes-queue.json)
// adr-vote [--root DIR] --reveal <page> <item>            close the round: mean, variance, converged; sets the weight when converged
// adr-vote [--root DIR] --note <page> <item> <agent|owner> "text"
import { addNote, applyVote, requestVotes, reveal } from "../src/votes.mjs";

const args = process.argv.slice(2);
const rootAt = args.indexOf("--root");
const root = rootAt >= 0 ? args.splice(rootAt, 2)[1] : ".";
const option = name => { const at = args.indexOf(name); return at >= 0 ? args.splice(at, 2)[1] : undefined; };
const voters = option("--voters"), requester = option("--as"), deadline = option("--deadline"), pageOpt = option("--page");
const mode = args.includes("--request") ? "request" : args.includes("--reveal") ? "reveal" : args.includes("--note") ? "note" : "vote";
const positional = args.filter(arg => !arg.startsWith("--"));
try {
  if (pageOpt) {
    for (const pair of positional) {
      const [item, score] = pair.split("=");
      const row = applyVote(root, { page: pageOpt, item, agent: requester, vote: score });
      console.log(`${item}: voted (${Object.keys(row.rounds.at(-1).votes).length} in)`);
    }
    process.exit(0);
  }
  const [page, item, who, last] = positional;
  const row = mode === "request" ? requestVotes(root, { page, item, voters: (voters ?? "").split(",").filter(Boolean), requester, deadlineMinutes: deadline })
    : mode === "reveal" ? reveal(root, { page, item })
    : mode === "note" ? addNote(root, { page, item, agent: who, text: last, as: who === "owner" ? "owner" : undefined })
    : applyVote(root, { page, item, agent: who, vote: last });
  console.log(JSON.stringify(row.rounds.at(-1)) + (row.weight ? ` weight=${row.weight}` : ""));
} catch (error) { console.error(error.message); process.exit(1); }
