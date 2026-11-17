#!/usr/bin/env node
// Standalone preview: serve a Markdown document without an agent session.
// Comments are saved to disk and stay unread until an agent session reads them; online agents,
// the store's owner included, are told over the mesh.
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveLaunch, USAGE } from "../src/launch.mjs";
import { startDocumentPreview } from "../src/preview.mjs";
import { spawn } from "node:child_process";
import { displayUrl, listServers, readHistory, recordExit, recordLaunch, startDetached, waitForExit } from "../src/servers.mjs";
import { runTui } from "../src/tui.mjs";

const storageRoot = join(process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "agent-doc-review");
// Watchdog: a detached server runs as a child of this supervisor and is restarted (same port and store) if it
// dies without a clean exit; clean exits (stop, restart) end the supervisor too. Gives up after 5 deaths in 2 minutes.
if (process.env.ADR_SUPERVISE === "1" && !process.env.ADR_CHILD) {
  const store = process.argv[process.argv.indexOf("--store") + 1] ?? "adr";
  const deaths = [];
  let child, stopping = false;
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => { stopping = true; child?.kill(signal); });
  while (!stopping) {
    child = spawn(process.execPath, process.argv.slice(1), { stdio: "inherit", env: { ...process.env, ADR_CHILD: "1" } });
    const [code, signal] = await new Promise(done => child.on("exit", (...args) => done(args)));
    if (stopping || (code === 0 && !signal)) break;
    const reason = `server died (${signal ? "signal " + signal : "code " + code}); restarting`;
    recordExit(storageRoot, store, reason);
    deaths.push(Date.now());
    while (deaths[0] < Date.now() - 120000) deaths.shift();
    if (deaths.length >= 5) { recordExit(storageRoot, store, "gave up: 5 deaths in 2 minutes"); break; }
    await new Promise(done => setTimeout(done, 1000));
  }
  process.exit(0);
}
if (process.argv[2] === "list" && process.argv.length === 3) {
  const rows = listServers(storageRoot, { prune: true });
  if (!rows.length) console.log("No ADR servers running.");
  for (const row of rows) console.log(`${displayUrl(row)}  pid ${row.pid}  store ${row.store}\n    ${row.root ?? ""}`);
  process.exit(0);
}
if (process.argv[2] === "tui" && process.argv.length === 3) {
  if (!process.stdin.isTTY) { console.error("adr tui needs a terminal"); process.exit(2); }
  runTui(storageRoot);
} else {
let launch;
try {
  launch = resolveLaunch(process.argv.slice(2));
} catch (error) {
  console.error(`${error.message}\n${USAGE}   (or: npm run preview -- ...)`);
  process.exit(2);
}
if (process.env.ADR_WAIT_PID) await waitForExit(Number(process.env.ADR_WAIT_PID)); // a restart: let the old server free its port
launch.name ??= readHistory(storageRoot).find(row => row.store === launch.store)?.name;
const shown = url => launch.name ? url.replace("127.0.0.1", `${launch.name}.localhost`) : url;
const startArgs = port => [launch.document, "--port", String(port), "--store", launch.store, ...(launch.name ? ["--name", launch.name] : [])];
if (launch.detach) {
  startDetached(storageRoot, startArgs(launch.port));
  for (let i = 0; i < 100; i++) {
    const found = listServers(storageRoot).find(row => row.store === launch.store);
    if (found) { console.log(`${displayUrl(found)}  (pid ${found.pid}; adr tui to restart or stop)`); process.exit(0); }
    await new Promise(done => setTimeout(done, 300));
  }
  console.error(`server did not start in 30 s; see ${join(storageRoot, launch.store)}.log`);
  process.exit(1);
}
let preview;
const stop = async () => {
  setTimeout(() => process.exit(0), 1000).unref(); // open sockets can stall a graceful close
  await preview.close().catch(() => {});
  process.exit(0);
};
preview = await startDocumentPreview({
  documentPath: launch.document,
  sessionId: launch.store,
  storageRoot,
  port: launch.port,
  name: launch.name,
  notify: () => {},
  ownerViaMesh: true,
  onRestart: () => {
    startDetached(storageRoot, startArgs(new URL(preview.origin).port), { ADR_WAIT_PID: String(process.pid) });
    stop();
  },
  onError: error => console.error(error),
});
recordLaunch(storageRoot, { store: launch.store, name: launch.name, document: launch.document, port: Number(new URL(preview.origin).port) });
console.log(`\n  ${shown(preview.url)}\n  comments: store ${launch.store}\n\n  Ctrl+C to stop.`);
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => { recordExit(storageRoot, launch.store, `stopped by ${signal}`); stop(); });
process.on("uncaughtException", error => { recordExit(storageRoot, launch.store, `uncaught exception: ${error.stack ?? error}`); process.exit(1); });
process.on("unhandledRejection", error => { recordExit(storageRoot, launch.store, `unhandled rejection: ${error?.stack ?? error}`); process.exit(1); });
}
