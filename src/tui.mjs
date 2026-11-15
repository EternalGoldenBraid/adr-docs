// `adr tui`: a dark, minimal list of running ADR servers. j/k move, x stops, o opens, r refreshes, q quits.
import { spawn } from "node:child_process";
import { listServers } from "./servers.mjs";

const BG = "\x1b[48;5;234m\x1b[38;5;252m";
const DIM = "\x1b[38;5;244m";
const SEL = "\x1b[48;5;238m\x1b[38;5;255m";
const OK = "\x1b[38;5;114m";
const WARN = "\x1b[38;5;215m";

export function runTui(storageRoot) {
  const out = process.stdout;
  let rows = [];
  let at = 0;
  let note = "";
  let confirm = false;

  const refresh = () => {
    rows = listServers(storageRoot, { prune: true });
    at = Math.min(at, Math.max(rows.length - 1, 0));
    draw();
  };
  const line = (text, style = "") => `${BG}${style}${text}\x1b[K`;
  function draw() {
    const width = out.columns || 80;
    const lines = [line(`  ADR servers · ${rows.length} running`, `${OK}\x1b[1m`), line("")];
    if (!rows.length) lines.push(line("  none running. start one with: adr <folder> -d", DIM));
    rows.forEach((row, i) => {
      const label = `  ${row.url}  pid ${row.pid}  ${row.root ?? ""}`.slice(0, width - 1);
      lines.push(line(label, i === at ? SEL : ""));
      if (i === at) lines.push(line(`    store ${row.store}`, `${SEL}${DIM}`));
    });
    lines.push(line(""), line(confirm ? `  stop ${rows[at]?.url}? y/n` : note, WARN));
    lines.push(line("  j/k move · x stop · o open · r refresh · q quit", DIM));
    out.write(`${BG}\x1b[2J\x1b[H${lines.join("\r\n")}`);
  }
  const stop = () => {
    out.write("\x1b[0m\x1b[?25h\x1b[?1049l");
    process.stdin.setRawMode(false);
    process.exit(0);
  };

  out.write("\x1b[?1049h\x1b[?25l");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", key => {
    const row = rows[at];
    if (confirm) {
      confirm = false;
      if (key === "y" && row) {
        try { process.kill(row.pid, "SIGTERM"); note = `stopped pid ${row.pid}`; } catch (error) { note = error.message; }
        setTimeout(refresh, 600);
      } else note = "";
    } else if (key === "q" || key === "\x03" || key === "\x1b") stop();
    else if (key === "j" || key === "\x1b[B") at = Math.min(at + 1, rows.length - 1);
    else if (key === "k" || key === "\x1b[A") at = Math.max(at - 1, 0);
    else if (key === "r") refresh();
    else if (key === "x" && row) { confirm = true; note = ""; }
    else if (key === "o" && row) spawn("xdg-open", [row.url], { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
    draw();
  });
  out.on("resize", draw);
  setInterval(refresh, 2000);
  refresh();
}
