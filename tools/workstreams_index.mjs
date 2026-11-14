#!/usr/bin/env node
// Write workstreams/index.md as a <WorkstreamBoard /> page (the board itself is built live from the front matter).
// `--json [dir]` prints the board as JSON instead.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readBoard } from "../src/workstreams.mjs";

const args = process.argv.slice(2);
const directory = args.find(a => !a.startsWith("--")) ?? fileURLToPath(new URL("../workstreams/", import.meta.url));
const board = readBoard(directory);
if (args.includes("--json")) { console.log(JSON.stringify(board, null, 2)); process.exit(0); }

// The page renders the board live from the ticket files; this only writes the one-line page.
writeFileSync(join(directory, "index.md"), ["---", "nav: Workstreams", "---", "", "# Workstreams", "",
  "Live from each ticket's front matter (JSON: `npm run workstreams -- --json`); schema in the [README](./README).", "", "<WorkstreamBoard />", ""].join("\n"));
