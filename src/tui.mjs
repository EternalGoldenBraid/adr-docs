// `adr tui`: a dark, minimal list of running ADR servers and recent ones. j/k move, r restarts or starts,
// x stops, o opens, q quits. Only servers started with `adr` can be stopped or restarted here.
import { spawn } from "node:child_process";
import { displayUrl, launchArgs, listServers, readHistory, startDetached, waitForExit } from "./servers.mjs";

const BG = "\x1b[48;5;234m\x1b[38;5;252m";
const DIM = "\x1b[38;5;244m";
const SEL = "\x1b[48;5;238m\x1b[38;5;255m";
const OK = "\x1b[38;5;114m";
const WARN = "\x1b[38;5;215m";

export function runTui(storageRoot) {
  const out = process.stdout;
  let items = []; // { kind: "running" | "recent", ... }
  let at = 0;
  let note = "";
  let confirm = false;

  const refresh = () => {
    const running = listServers(storageRoot, { prune: true });
    const live = new Set(running.map(row => row.store));
    items = [
      ...running.map(row => ({ kind: "running", ...row })),
      ...readHistory(storageRoot).filter(row => !live.has(row.store)).map(row => ({ kind: "recent", ...row })),
    ];
    at = Math.min(at, Math.max(items.length - 1, 0));
    draw();
  };
  const line = (text, style = "") => `${BG}${style}${text}\x1b[K`;
  const label = item => `${item.kind === "running" ? displayUrl(item) : `${item.name ? item.name + " " : ""}:${item.port}`}  ${item.kind === "running" ? `pid ${item.pid}  ` : ""}${item.root ?? item.document ?? ""}`;
  function draw() {
    const width = out.columns || 80;
    const running = items.filter(item => item.kind === "running").length;
    const lines = [line(`  ADR servers · ${running} running`, `${OK}\x1b[1m`), line("")];
    if (!running) lines.push(line("  none running. start one with: adr <folder> -d", DIM));
    let shownRecent = false;
    items.forEach((item, i) => {
      if (item.kind === "recent" && !shownRecent) {
        shownRecent = true;
        lines.push(line(""), line("  recent (r starts again)", DIM));
      }
      const mark = item.kind === "running" ? (item.standalone ? "" : " ·agent") : "";
      lines.push(line(`  ${label(item)}${mark}`.slice(0, width - 1), i === at ? SEL : item.kind === "recent" ? DIM : ""));
      if (i === at && item.store) lines.push(line(`    store ${item.store}`, `${SEL}${DIM}`));
    });
    const item = items[at];
    lines.push(line(""), line(confirm ? `  stop ${item && displayUrl(item)}? y/n` : note, WARN));
    lines.push(line("  j/k move · r restart · x stop · o open · q quit", DIM));
    out.write(`${BG}\x1b[2J\x1b[H${lines.join("\r\n")}`);
  }
  const quit = () => {
    out.write("\x1b[0m\x1b[?25h\x1b[?1049l");
    process.stdin.setRawMode(false);
    process.exit(0);
  };
  const guard = item => item.kind !== "running" || item.standalone ? "" : "that server belongs to an agent session; stop it there (stop_doc_review)";
  async function restart(item) {
    if (guard(item)) { note = guard(item); draw(); return; }
    if (item.kind === "running") {
      try { process.kill(item.pid, "SIGTERM"); } catch (error) { note = error.message; draw(); return; }
      if (!await waitForExit(item.pid)) { note = "the server did not stop in 10 s"; draw(); return; }
    }
    const entry = item.kind === "running" ? readHistory(storageRoot).find(row => row.store === item.store) : item;
    if (!entry) { note = "no launch history for this server (it was started by an older adr); start it again with adr"; draw(); return; }
    startDetached(storageRoot, launchArgs(entry));
    note = `restarting ${entry.name ?? entry.document}…`;
    setTimeout(refresh, 2500);
    draw();
  }

  out.write("\x1b[?1049h\x1b[?25l");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", async key => {
    const item = items[at];
    if (confirm) {
      confirm = false;
      if (key === "y" && item) {
        try { process.kill(item.pid, "SIGTERM"); note = `stopped pid ${item.pid}`; } catch (error) { note = error.message; }
        setTimeout(refresh, 600);
      } else note = "";
    } else if (key === "q" || key === "\x03" || key === "\x1b") quit();
    else if (key === "j" || key === "\x1b[B") at = Math.min(at + 1, items.length - 1);
    else if (key === "k" || key === "\x1b[A") at = Math.max(at - 1, 0);
    else if (key === "x" && item?.kind === "running") { if (guard(item)) note = guard(item); else { confirm = true; note = ""; } }
    else if (key === "r" && item) { await restart(item); return; }
    else if (key === "o" && item?.kind === "running") spawn("xdg-open", [displayUrl(item)], { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
    draw();
  });
  out.on("resize", draw);
  setInterval(refresh, 2000);
  refresh();
}
