#!/usr/bin/env node
// Offline copy of one or more pages: a single .html (or a .zip when several pages or large media).
import { resolve } from "node:path";
import { exportPage } from "../src/export.mjs";

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i < 0 ? undefined : args.splice(i, 2)[1]; };
const pages = [];
for (let page; (page = flag("--page")) !== undefined;) pages.push(page);
const out = flag("--out");
const limit = flag("--inline-media-under");
const zip = args.includes("--zip") ? (args.splice(args.indexOf("--zip"), 1), true) : undefined;
const take = name => args.includes(name) ? (args.splice(args.indexOf(name), 1), true) : undefined;
const single = take("--single");
const serve = take("--serve");
const compress = take("--compress");
const [file] = args;
if (!file) {
  console.error("usage: adr-export <file.md> [--page /path]... [--out file] [--zip] [--single [--compress]] [--serve] [--inline-media-under <MB>]");
  process.exit(2);
}
const result = await exportPage({
  documentPath: resolve(file), pages,
  onProgress: ({ stage, done, total }) => console.error(`[${done}/${total}] ${stage}`),
  outFile: out, zip, single, compress, serve,
  ...(limit ? { inlineLimit: Number(limit) * 1024 * 1024 } : {}),
});
for (const warning of result.warnings) console.error(`warning: ${warning}`);
console.log(`${result.file} (${result.kind}, ${(result.bytes / 1024).toFixed(0)} KB)`);
