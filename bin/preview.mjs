#!/usr/bin/env node
// Standalone preview: serve a Markdown document without an agent session.
// Comments are saved to disk and stay unread until an agent session reads them; online agents,
// the store's owner included, are told over the mesh.
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveLaunch, USAGE } from "../src/launch.mjs";
import { startDocumentPreview } from "../src/preview.mjs";
import { listServers } from "../src/servers.mjs";

const storageRoot = join(process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "agent-doc-review");
if (process.argv[2] === "list" && process.argv.length === 3) {
  const rows = listServers(storageRoot, { prune: true });
  if (!rows.length) console.log("No ADR servers running.");
  for (const row of rows) console.log(`${row.url}  pid ${row.pid}  store ${row.store}\n    ${row.root ?? ""}`);
  process.exit(0);
}
let launch;
try {
  launch = resolveLaunch(process.argv.slice(2));
} catch (error) {
  console.error(`${error.message}\n${USAGE}   (or: npm run preview -- ...)`);
  process.exit(2);
}
const preview = await startDocumentPreview({
  documentPath: launch.document,
  sessionId: launch.store,
  storageRoot,
  port: launch.port,
  notify: () => {},
  ownerViaMesh: true,
  onError: error => console.error(error),
});
console.log(`\n  ${preview.url}\n  comments: store ${launch.store}\n\n  Ctrl+C to stop.`);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    setTimeout(() => process.exit(0), 1000).unref(); // open sockets can stall a graceful close
    preview.close().finally(() => process.exit(0));
  });
}
