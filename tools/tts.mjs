#!/usr/bin/env node
// Start or stop the text-to-speech server used by "read aloud" (:read, the 🔊 buttons).
//   node tools/tts.mjs start | stop | status
// F5-TTS runs on a GPU host over ssh and speaks in the voice of a reference clip; an ssh tunnel brings it to 127.0.0.1.
// ADR_TTS_HOST (default gpu), ADR_TTS_GPU (default 1), ADR_TTS_VENV (default ~/venvs/f5 on the host),
// ADR_TTS_REF (default ~/.local/share/agent-doc-review/voice/ref.wav), ADR_TTS_PORT (default 8765).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const host = process.env.ADR_TTS_HOST || "gpu";
const gpu = process.env.ADR_TTS_GPU || "1";
const venv = process.env.ADR_TTS_VENV || "~/venvs/f5";
const port = Number(process.env.ADR_TTS_PORT || 8765);
const ref = process.env.ADR_TTS_REF || join(homedir(), ".local/share/agent-doc-review/voice/ref.wav");
const state = join(homedir(), ".local/state/agent-doc-review");
const pidFile = join(state, "tts-tunnel.pid");
const server = join(dirname(fileURLToPath(import.meta.url)), "tts_server.py");
const ssh = (...args) => spawnSync("ssh", ["-o", "BatchMode=yes", "-o", "ForwardX11=no", host, ...args], { encoding: "utf8" });
const up = async () => { try { return (await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(2000) })).ok; } catch { return false; } };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const command = process.argv[2];
if (command === "status") {
  console.log((await up()) ? `running on 127.0.0.1:${port} (${host})` : "not running");
} else if (command === "start") {
  if (await up()) { console.log("already running"); process.exit(0); }
  if (!existsSync(ref)) { console.error(`No reference voice at ${ref}. Put a 5-15 s mono clip of the voice there (or set ADR_TTS_REF).`); process.exit(1); }
  ssh("mkdir -p adr-tts");
  for (const file of [server, ref]) if (spawnSync("scp", ["-q", "-o", "BatchMode=yes", file, `${host}:adr-tts/${file === ref ? "ref.wav" : "tts_server.py"}`]).status) { console.error("Could not copy files to " + host); process.exit(1); }
  const launch = `cd adr-tts && (pgrep -f "^[^ ]*/bin/python tts_server.py" >/dev/null || (CUDA_VISIBLE_DEVICES=${gpu} nohup ${venv}/bin/python tts_server.py --ref ref.wav --port ${port} > log.txt 2>&1 &))`;
  if (ssh(launch).status) { console.error("Could not start the server on " + host); process.exit(1); }
  mkdirSync(state, { recursive: true });
  const tunnel = spawn("ssh", ["-N", "-o", "ExitOnForwardFailure=yes", "-o", "ForwardX11=no", "-L", `${port}:127.0.0.1:${port}`, host], { detached: true, stdio: "ignore" });
  tunnel.unref();
  writeFileSync(pidFile, String(tunnel.pid));
  process.stdout.write("Loading the model (about a minute the first time)…");
  for (let i = 0; i < 120 && !(await up()); i++) { await sleep(2000); process.stdout.write("."); }
  console.log((await up()) ? "\nReady. Use :read in the preview." : `\nNot ready; see ${host}:adr-tts/log.txt`);
} else if (command === "stop") {
  if (existsSync(pidFile)) { try { process.kill(Number(readFileSync(pidFile, "utf8"))); } catch { /* tunnel already gone */ } rmSync(pidFile); }
  ssh(`kill $(pgrep -f "[t]ts_server.py") 2>/dev/null; true`);
  console.log("stopped");
} else {
  console.error("Usage: node tools/tts.mjs start|stop|status");
  process.exit(1);
}
