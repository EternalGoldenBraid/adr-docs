#!/usr/bin/env node
// Standalone preview: serve a Markdown document without an agent session.
// Comments are saved to disk and stay unread until an agent session reads them.
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { startDocumentPreview } from "../src/preview.mjs";

const [file, portArg] = process.argv.slice(2);
if (!file) {
  console.error("usage: npm run preview -- <file.md> [port]");
  process.exit(2);
}
const preview = await startDocumentPreview({
  documentPath: resolve(file),
  sessionId: "00000000-0000-4000-8000-000000000000",
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
