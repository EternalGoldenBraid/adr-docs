#!/usr/bin/env node
// Fails (exit 1) when a page with a card lacks a mandatory field (gist, owner, state). Usage: adr-check <site-root>
import { pageCards } from "../src/page-tree.mjs";
const root = process.argv[2] ?? ".";
const bad = Object.entries(pageCards(root)).filter(([, c]) => c.missing);
for (const [link, c] of bad) console.error(`${link}: card missing ${c.missing.join(", ")}`);
process.exit(bad.length ? 1 : 0);
