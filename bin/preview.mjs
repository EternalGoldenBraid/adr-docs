#!/usr/bin/env node
// Standalone preview: serve a Markdown document without an agent session.
// Comments are saved to disk and stay unread until an agent session reads them.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { startDocumentPreview } from "../src/preview.mjs";

const [file, portArg] = process.argv.slice(2);
if (!file || !existsSync(file) || (portArg !== undefined && !/^\d+$/.test(portArg))) {
  console.error("usage: adr <file.md> [port]   (or: npm run preview -- <file.md> [port])");
  process.exit(2);
}
// One stable comment store per document, so previews of different files do not share threads.
const hex = createHash("sha256").update(resolve(file)).digest("hex");
const sessionId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
const preview = await startDocumentPreview({
  documentPath: resolve(file),
  sessionId,
  storageRoot: join(process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "agent-doc-review"),
  port: portArg ? Number(portArg) : 0,
  notify: () => {},
  onError: error => console.error(error),
});
console.log(`\n  ${preview.url}\n\n  Ctrl+C to stop.`);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    setTimeout(() => process.exit(0), 1000).unref(); // open sockets can stall a graceful close
    preview.close().finally(() => process.exit(0));
  });
}
