import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import {
  appendFileSync, closeSync, copyFileSync, cpSync, statSync, existsSync, fsyncSync, mkdirSync, openSync,
  readdirSync, readFileSync, readSync, realpathSync, renameSync, rmSync, unlinkSync, writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { homedir, hostname } from "node:os";
import { execFile, spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
const USER_MARK_FROM = "2026-11-21T00:00:00";
const ROOMS_FROM = "2026-11-22T08:30:00Z";
const meshCodeDirectory = join(homedir(), ".copilot", "extensions", "agent-mesh");
// MESH_DIR, else ~/.agent-mesh, else the pre-move location inside the extension.
function meshDataDirectory() {
  if (process.env.MESH_DIR) return process.env.MESH_DIR;
  const moved = join(homedir(), ".agent-mesh");
  return existsSync(join(moved, "agent-mesh.db")) ? moved : meshCodeDirectory;
}
import { readCell, writeCell } from "./table-edit.mjs";
import { bareSession, readRoster, slugify } from "../../src/roster.mjs";
import { answerRates, rank } from "../../src/nudge-plan.mjs";
import { deriveState, disagrees, itemTurns } from "../../src/verified-state.mjs";
import { addNote, applyVote, publicVotes, readVotes, refreshQueue, requestVotes, reveal } from "../../src/votes.mjs";
import { pageCards, readPageTree } from "../../src/page-tree.mjs";
import { diffLines, hunks } from "./page-diff.mjs";

function append(file, record) {
  const fd = openSync(file, "a", 0o600);
  try {
    appendFileSync(fd, JSON.stringify(record) + "\n");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function reply(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

function field(value, name, limit) {
  if (typeof value !== "string" || !value.trim() || Buffer.byteLength(value) > limit) {
    throw new Error(`${name} must contain 1–${limit} UTF-8 bytes.`);
  }
  return value.trim();
}

const COLORS = ["yellow", "green", "blue", "pink", "red"];

function identifier(value, name) {
  const id = field(value, name, 36);
  if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) throw new Error(`Invalid ${name}.`);
  return id;
}

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_ID = /^[\da-f]{64}$/;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

class CommentConflict extends Error {}

export async function startCommentBridge({
  sessionId, documentRoot, previewOrigin, storageRoot, notify, onError, mesh, ownerViaMesh = false, name, onRestart, dataDirectory,
}) {
  const root = realpathSync(documentRoot);
  const directory = join(storageRoot, sessionId); // runtime files (connection.json, exit.json)
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  // Comments, settings, images and audio live with the site (<site>/.adr-data) when the launcher gives a data directory;
  // a store that so far lived in the state directory is moved there once.
  const data = dataDirectory ?? directory;
  if (data !== directory) {
    mkdirSync(data, { recursive: true, mode: 0o700 });
    // A symlinked data directory could point anywhere (even into the tool's own checkout); keep it inside the site.
    if (!realpathSync(data).startsWith(root + "/")) throw new Error(`${data} resolves outside the site folder (${realpathSync(data)}); remove or rename it.`);
    writeFileSync(join(data, ".gitignore"), "*\n");
    writeFileSync(join(data, "store"), sessionId + "\n");
    if (!existsSync(join(data, "comments.jsonl"))) {
      for (const file of ["comments.jsonl", "settings.json", "attachments", "speech"]) {
        if (!existsSync(join(directory, file))) continue;
        try { renameSync(join(directory, file), join(data, file)); } catch { cpSync(join(directory, file), join(data, file), { recursive: true }); rmSync(join(directory, file), { recursive: true, force: true }); }
      }
    }
  }
  const attachments = join(data, "attachments");
  mkdirSync(attachments, { recursive: true, mode: 0o700 });
  const imageFile = id => join(attachments, id + ".png");
  const speechDir = join(data, "speech");
  mkdirSync(speechDir, { recursive: true, mode: 0o700 });
  // Read aloud: text goes to a local text-to-speech server (ADR_TTS_URL, default via `adr tts` on 127.0.0.1:8765); audio is cached by text.
  const speechUrl = process.env.ADR_TTS_URL || "http://127.0.0.1:8765";
  const speaking = new Map();
  // First read-aloud with the server down starts it (tools/tts.mjs start, about a minute), unless the user turned it off.
  let speechStart = null;
  const startSpeechServer = () => speechStart ??= new Promise(done => {
    const child = spawn(process.execPath, [fileURLToPath(new URL("../../tools/tts.mjs", import.meta.url)), "start"], { stdio: "ignore" });
    child.on("error", () => done(false));
    child.on("exit", code => done(code === 0));
  }).finally(() => { speechStart = null; });
  async function speech(text) {
    if (typeof text !== "string" || !text.trim()) throw new Error("Nothing to read.");
    const id = createHash("sha256").update(text.trim()).digest("hex");
    const file = join(speechDir, id + ".wav");
    if (existsSync(file)) return id;
    if (!speaking.has(id)) {
      speaking.set(id, (async () => {
        const speak = () => fetch(speechUrl + "/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.trim() }), signal: AbortSignal.timeout(120_000) });
        let result;
        try {
          result = await speak().catch(async error => {
            if (settings.tts === false || !(await startSpeechServer())) throw error;
            return speak();
          });
        } catch {
          throw new Error(settings.tts === false ? "Text-to-speech is off (:tts on to enable)." : "Text-to-speech server could not be started. Try `node tools/tts.mjs start`.");
        }
        if (!result.ok) throw new Error(`Text-to-speech failed (${result.status}).`);
        writeFileSync(file, Buffer.from(await result.arrayBuffer()), { mode: 0o600 });
      })().finally(() => speaking.delete(id)));
    }
    await speaking.get(id);
    return id;
  }
  const log = join(data, "comments.jsonl");
  const connectionFile = join(directory, "connection.json");
  const records = existsSync(log)
    ? readFileSync(log, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line))
    : [];
  const comments = new Map();
  const updates = new Map();
  const settingsFile = join(data, "settings.json");
  let settings = { owner: "owner", team: [], default: "owner", last: [] };
  try { settings = { ...settings, ...JSON.parse(readFileSync(settingsFile, "utf8")) }; } catch { /* first run: defaults */ }
  const NAME = /^[\w.-]{1,40}$/;
  const names = (value, label) => {
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || value.length > 12 || !value.every(name => typeof name === "string" && NAME.test(name))) {
      throw new Error(`${label} must list at most 12 short names.`);
    }
    return [...new Set(value.map(canon))];
  };
  // An `@agent` in a message addresses it; only names on the team count, so emails and handles do not.
  const mentioned = text => {
    const team = new Set(teamNames());
    return [...new Set([...String(text ?? "").matchAll(/(?<![\w@.-])@([\w.-]{1,60})/g)].map(m => canon(m[1].replace(/[.-]+$/, ""))).filter(name => team.has(name)))];
  };
  // The team page (src/roster.mjs) is the source of the team when it lists agent sessions; settings are the fallback.
  let rosterAt = 0, rosterRows = [];
  const roster = () => {
    if (Date.now() - rosterAt > 2000) {
      try { rosterRows = readRoster(documentRoot); } catch { rosterRows = []; }
      rosterAt = Date.now();
    }
    return rosterRows;
  };
  const agents = () => roster().filter(row => row.session);
  const ownerName = () => agents().find(row => row.session === sessionId)?.slug ?? settings.owner;
  const teamNames = () => agents().length ? agents().map(row => row.slug) : settings.team;
  const rowForSession = session => agents().find(row => row.session === session);
  const nameFor = value => rowForSession(value)?.slug ?? value;
  // Autopilot: while it runs ADR sends no nudges and tells agents to keep working. Only the clock ends it.
  const autopilot = () => settings.autopilot && Date.parse(settings.autopilot.until) > Date.now() ? settings.autopilot : null;
  const autopilotNote = () => { const ap = autopilot(); return ap ? `Autopilot is on until ${ap.until}: keep working, post one finish report, ask only if blocked, and do not wait for votes or resolves.${ap.brief ? ` Brief: ${ap.brief}` : ""}` : ""; };
  const effective = () => ({ ...settings, autopilot: autopilot() ?? undefined, owner: ownerName(), team: teamNames(), roster: roster(), fromRoster: agents().length > 0 });
  const canon = name => agents().find(row => row.legacy === name && row.slug !== name)?.slug ?? name;
  const addressed = (comment, name) => comment.to?.length ? comment.to.map(canon).includes(name) : name === ownerName();
  const readBy = (comment, name) => name === ownerName() ? comment.seen : Boolean(comment.readBy?.[name]);

  // Agents on enrolled peer machines are asked over the mesh's own SSH route (machines.json); cached so polling stays cheap.
  const remote = new Map();
  let remoteAt = 0, remoteLoading;
  const remoteErrors = new Map();
  function refreshRemote() {
    if (remoteLoading) return remoteLoading;
    remoteAt = Date.now();
    remoteLoading = (async () => {
      const { loadMachines, requestPeer } = await import(pathToFileURL(join(meshCodeDirectory, "network.mjs")).href);
      const config = loadMachines(join(meshDataDirectory(), "machines.json"));
      const wanted = new Set(roster().filter(row => row.session && row.machine && config?.peers && Object.hasOwn(config.peers, row.machine)).map(row => row.machine));
      await Promise.all([...wanted].map(async machine => {
        try {
          const result = await requestPeer(config, machine, "list", { status: "all" });
          for (const agent of result.agents) remote.set(agent.session_id, agent);
          remoteErrors.delete(machine);
        } catch (error) { remoteErrors.set(machine, error.message); }
      }));
    })().catch(error => remoteErrors.set("*", error.message)).finally(() => { remoteLoading = undefined; });
    return remoteLoading;
  }

  // Machine load from each host's ~/.mesh/load.jsonl (one sample a minute); remote hosts are read over ssh, cached for 20 s.
  const loadCache = new Map();
  function summariseLoad(name, lines) {
    const rows = lines.map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(row => row?.loadavg);
    const last = rows.at(-1);
    if (!last) return { name, error: "no samples" };
    return {
      name, host: last.host, nproc: last.nproc, at: last.ts, stale: Date.now() / 1000 - last.ts > 300,
      loadavg: last.loadavg, history: rows.map(row => row.loadavg[0]),
      memUsed: last.memory?.total ? 1 - last.memory.available / last.memory.total : undefined,
      cores: last.cores ?? [], gpus: last.gpus ?? [], top: (last.top ?? []).slice(0, 3),
    };
  }
  function machineLoad(name, remoteHost) {
    const cached = loadCache.get(name);
    if (cached && Date.now() - cached.at < 20000) return cached.promise;
    const promise = new Promise(resolveLoad => {
      if (!remoteHost) {
        try { resolveLoad(summariseLoad(name, readFileSync(join(homedir(), ".mesh", "load.jsonl"), "utf8").trim().split("\n").slice(-60))); } catch { resolveLoad({ name, error: "no load file" }); }
        return;
      }
      execFile("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=4", remoteHost, "tail -n 60 ~/.mesh/load.jsonl"], { timeout: 8000, maxBuffer: 1 << 20 },
        (error, stdout) => resolveLoad(error ? { name, error: "unreachable" } : summariseLoad(name, stdout.trim().split("\n"))));
    });
    loadCache.set(name, { at: Date.now(), promise });
    return promise;
  }
  async function machines() {
    const local = hostname();
    const names = [...new Set(roster().map(row => row.machine).filter(Boolean))].filter(name => name !== local);
    return Promise.all([machineLoad(local, null), ...names.map(name => machineLoad(name, name))]);
  }

  // Verified state: derived from each session's own events.jsonl (tail), locally or over ssh for peer machines; cached for a few seconds.
  const TAIL = 200_000;
  const logCache = new Map();
  function remoteLogs(machine, sessions) {
    const cached = logCache.get(machine);
    if (cached && Date.now() - cached.at < 10_000) return cached.promise;
    const script = sessions.map(id => `echo "@@${id}"; tail -c ${TAIL} ~/.copilot/session-state/${id}/events.jsonl 2>/dev/null`).join("; ");
    const promise = new Promise(done => execFile("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=4", machine, script], { timeout: 10_000, maxBuffer: 16 << 20 }, (error, stdout) => {
      const out = new Map();
      if (!error) for (const part of stdout.split("@@").slice(1)) { const [id, ...rest] = part.split("\n"); out.set(id.trim(), rest); }
      done(out);
    }));
    logCache.set(machine, { at: Date.now(), promise });
    return promise;
  }
  function localLog(id) {
    try {
      const file = join(homedir(), ".copilot", "session-state", id, "events.jsonl");
      const size = statSync(file).size;
      const fd = openSync(file, "r");
      try {
        const buffer = Buffer.alloc(Math.min(size, TAIL));
        readSync(fd, buffer, 0, buffer.length, size - buffer.length);
        return buffer.toString("utf8").split("\n");
      } finally { closeSync(fd); }
    } catch { return null; }
  }
  async function verifiedStates(rows, queues = {}) {
    const out = new Map();
    const peers = new Map();
    for (const row of rows.filter(r => r.session)) {
      if (row.machine && row.machine !== hostname()) peers.set(row.machine, [...(peers.get(row.machine) ?? []), row.session]);
      else { const lines = localLog(row.session); if (lines) out.set(row.session, deriveState(lines, Date.now(), queues[row.slug] ?? [])); }
    }
    for (const [machine, sessions] of peers) for (const [id, lines] of await remoteLogs(machine, sessions)) out.set(id, deriveState(lines, Date.now(), queues[rows.find(r => r.session === id)?.slug] ?? []));
    return out;
  }

  let meshEdges = [];
  async function meshStatus() {
    if (!remoteAt) await refreshRemote(); else if (Date.now() - remoteAt > 15000) refreshRemote();
    const known = agents();
    let live = new Map();
    const statusLines = new Map();
    const edges = new Map();
    try {
      const db = new DatabaseSync(process.env.ADR_MESH_DB || join(meshDataDirectory(), "agent-mesh.db"), { readOnly: true });
      try {
        const marks = known.map(() => "?").join(",");
        const columns = db.prepare("PRAGMA table_info(agent_sessions)").all().some(column => column.name === "kind") ? "kind" : "'agent' AS kind";
        live = new Map(db.prepare(`SELECT session_id, cwd, status, ${columns}, last_heartbeat FROM agent_sessions WHERE session_id IN (${marks})`).all(...known.map(row => row.session)).map(row => [row.session_id, row]));
        // Latest `STATUS <ticket> | <state> | <doing> | <next>` reply per agent, and who wrote to whom recently (never other message bodies).
        const sessions = new Set(known.map(row => row.session));
        const since = new Date(Date.now() - 3600_000).toISOString();
        for (const message of db.prepare("SELECT sender_session_id AS s, recipient_session_id AS r, created_at AS at, CASE WHEN content LIKE 'STATUS %' THEN content END AS line FROM agent_messages WHERE created_at > ? OR content LIKE 'STATUS %' ORDER BY message_id").all(since)) {
          const from = bareSession(message.s), to = bareSession(message.r);
          if (message.line && sessions.has(from)) {
            const [ticket, state, doing, next] = message.line.split("\n")[0].slice(7).split("|").map(part => part.trim());
            if (state) statusLines.set(from, { ticket: ticket === "-" ? "" : ticket, state, doing: doing ?? "", next: !next || next === "-" ? "" : next, at: message.at });
          }
          if (message.at > since && sessions.has(from) && sessions.has(to) && from !== to) {
            const key = `${from}>${to}`;
            const edge = edges.get(key) ?? { from, to, count: 0, at: message.at };
            edge.count += 1; edge.at = message.at;
            edges.set(key, edge);
          }
        }
      } finally { db.close(); }
    } catch { /* no local mesh database */ }
    meshEdges = [...edges.values()];
    // Per-pane hook state from the desktop's agent-notify (working|waiting|asking|idle), matched by working directory.
    const activity = new Map();
    try {
      const dir = join(process.env.XDG_RUNTIME_DIR || `/run/user/${process.getuid?.() ?? 1000}`, "agent-notify");
      for (const name of readdirSync(dir).filter(file => file.endsWith(".json"))) {
        const note = JSON.parse(readFileSync(join(dir, name), "utf8"));
        if (note.cwd && note.state && Date.now() / 1000 - note.ts < 12 * 3600 && !(activity.get(note.cwd)?.ts > note.ts)) activity.set(note.cwd, note);
      }
    } catch { /* no agent-notify on this machine */ }
    const rows = roster();
    let queued = {};
    try { queued = JSON.parse(readFileSync(join(documentRoot, "queues.json"), "utf8")); } catch { /* no queues.json */ }
    const verified = await verifiedStates(rows, queued).catch(() => new Map());
    return rows.map(row => {
      const seen = live.get(row.session) ?? remote.get(row.session);
      const proof = verified.get(row.session) ?? null;
      return { ...row, verified: proof && { ...proof, mismatch: disagrees(statusLines.get(row.session)?.state, proof) }, status: !row.session ? "human" : seen ? seen.status : "unknown", lastSeen: seen?.last_heartbeat ?? null, kind: seen?.kind ?? (row.session ? "agent" : "human"), statusLine: statusLines.get(row.session) ?? null, waiting: waits.get(row.slug)?.what ?? null, activity: activity.get(seen?.cwd)?.state ?? null };
    });
  }
  // Sessions on enrolled peer machines are sent through the mesh router with their machine name; a plain local send never reaches them.
  function meshAddress(row) {
    try {
      const peers = JSON.parse(readFileSync(join(meshDataDirectory(), "machines.json"), "utf8")).peers ?? {};
      if (row.machine && Object.hasOwn(peers, row.machine)) return { session: row.session, machine: row.machine };
    } catch { /* no machines.json: local only */ }
    return { session: row.session };
  }
  // Quiet mesh note to each addressed agent other than the owner; they pull the thread when they choose.
  // Without a hosting agent session (ownerViaMesh), the owner is also told this way, including of unaddressed comments.
  // Agent-authored threads and replies pass `only` (their recipients) and `sender`, who is not told of their own message.
  function announce(comment, text, queued = false, only, sender) {
    const names = (only?.length ? only.map(canon) : comment.to?.length ? comment.to.filter(name => !comment.muted?.[name]).map(canon) : ownerViaMesh ? [ownerName()] : []).filter(who => !sender || (who !== canon(sender) && who !== canon(slugify(sender))));
    if (!mesh) return;
    for (const who of names) {
      const target = agents().find(row => row.slug === who);
      if (!target || (who === ownerName() && !ownerViaMesh)) continue;
      const page = new URL(comment.url).pathname;
      const flat = text.replace(/\s+/g, " ");
      const preview = flat.length > 400 ? `${flat.slice(0, 400)}… [truncated; read the thread for the rest]` : flat;
      const note = `ADR comment for you on ${page} (thread ${comment.id.slice(0, 8)}): "${preview}". ` +
        `Read: read_doc_review_comments(as="${target.slug}", store="${name ?? sessionId}"); reply: update_doc_review_comment(store="${name ?? sessionId}", comment_id="${comment.id}").` +
        (autopilotNote() ? ` ${autopilotNote()}` : "");
      // A recipient that is not on the mesh right now would otherwise never hear of it: retry until it is, or it has read the thread.
      const attempt = async tries => {
        // Queued: hold the note while the recipient is working, so it arrives when it is free.
        if (queued && target.session && agents().find(row => row.slug === who)?.status === "working" && tries < 720) {
          setTimeout(() => { const live = comments.get(comment.id); if (live && !live.resolved && !readBy(live, target.slug)) attempt(tries + 1); }, 5_000).unref();
          return;
        }
        try { await mesh.send(meshAddress(target).session, note, meshAddress(target).machine); } catch (error) {
          if (!tries) onError?.(error);
          if (tries < 360) setTimeout(() => { const live = comments.get(comment.id); if (live && !live.resolved && !readBy(live, target.slug)) attempt(tries + 1); }, 60_000).unref();
        }
      };
      attempt(0);
    }
  }
  // Idle nudge: an agent that has been idle for NUDGE_AFTER with open work (queue items, or threads waiting on it) gets one mesh note,
  // then at most one per NUDGE_EVERY; none while it is working. Idle comes from the agent-notify hook or its status line (ticket|state|...).
  // Threads waiting on you are pinged after 10 s idle; other queue items after 1 min. Repeats: 5 min (threads) or 30 min (items) without progress, the same idle wait after progress.
  const NUDGE_AFTER = Number(process.env.ADR_NUDGE_MINUTES ?? 1) * 60_000, NUDGE_THREAD_AFTER = 10_000, NUDGE_THREAD_EVERY = 5 * 60_000, NUDGE_EVERY = 30 * 60_000;
  const idleSince = new Map(), nudgedAt = new Map(), nudgedCount = new Map(), nudged = new Map(), streak = new Map(), waits = new Map();
  // An agent that says what it waits on ("a refit job") is not nudged until the time passes; each unanswered nudge doubles the gap (5, 10, 20, 40, 60 min).
  const backoff = slug => Math.min(NUDGE_THREAD_EVERY * 2 ** Math.min(streak.get(slug) ?? 0, 4), 60 * 60_000);
  // A pid ties the wait to a local process: the nudges resume when it exits, so "waiting" cannot outlive the job it names.
  const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; } };
  // A catalog run ends the wait when its progress.phase is "done", when the service no longer knows it, or when it has reported nothing new for 10 minutes
  // (the scalars.jsonl size is the report). A thread ends it when someone else replies there. Run and thread checks run at most every 30 s.
  const CATALOG = process.env.ADR_CATALOG ?? "http://127.0.0.1:8766";
  const runEnded = async w => {
    try {
      const res = await fetch(`${CATALOG}/runs/${w.run}`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return true;
      const run = await res.json();
      if (run.progress?.phase === "done") return true;
      const file = run.items?.find(item => item.file === "scalars.jsonl")?.url;
      const size = file ? (await fetch(`${CATALOG}${file}`, { signal: AbortSignal.timeout(3000) })).headers.get("content-length") : null;
      const mark = `${run.progress?.step}|${size}`;
      if (mark !== w.mark) { w.mark = mark; w.movedAt = Date.now(); }
      return Date.now() - (w.movedAt ?? Date.now()) > 10 * 60_000;
    } catch { return true; }
  };
  const threadAnswered = (slug, w) => (comments.get(w.thread)?.replies ?? []).some(reply => reply.from && canon(reply.from) !== slug && Date.parse(reply.at) > w.since) || !comments.get(w.thread);
  const waitingOn = async slug => {
    const w = waits.get(slug);
    if (!w) return null;
    let ended = w.until <= Date.now() || (w.pid && !alive(w.pid)) || (w.thread && threadAnswered(slug, w));
    if (!ended && w.run && Date.now() - (w.checkedAt ?? 0) > 30_000) { w.checkedAt = Date.now(); ended = await runEnded(w); }
    if (ended) { waits.delete(slug); return null; }
    return w;
  };
  const readQueues = () => { try { return JSON.parse(readFileSync(join(documentRoot, "queues.json"), "utf8")); } catch { return {}; } };
  const openWork = slug => {
    const items = (readQueues()[slug] ?? []).filter(item => item.state !== "done" && !item.held).sort((a, b) => a.rank - b.rank);
    const { threads, toResolve } = unansweredFor(slug);
    return { items, threads, toResolve };
  };
  // Every thread nudge is logged; whether the agent replied within 30 min feeds the per-agent answer rate that orders later nudges.
  const nudgeLog = join(data, "nudges.jsonl");
  const logNudge = (slug, thread, kind) => append(nudgeLog, { at: new Date().toISOString(), slug, thread, kind });
  const answerRate = () => {
    let rows = [];
    try { rows = readFileSync(nudgeLog, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line)); } catch { /* none yet */ }
    return answerRates(rows, (slug, thread) => (comments.get(thread)?.replies ?? []).filter(reply => reply.from && canon(reply.from) === slug).map(reply => Date.parse(reply.at)));
  };
  // Members are members: the user's seat in `to` is the same seat as their own "you" mark, so it is one resolve, not two.
  const humanSeat = () => roster().find(row => !row.session)?.slug;
  // A seat is someone who can answer: a roster agent or the human. The store's own placeholder owner name (no session) never can, so it must not hold a thread open.
  const seatsIn = c => [...new Set((c.to ?? []).filter(name => !c.muted?.[name]).map(canon).filter(name => name === humanSeat() || !agents().length || agents().some(row => row.slug === name)).map(name => name === humanSeat() ? "you" : name))];
  const missingOn = id => { const c = comments.get(id); return c ? seatsIn(c).filter(name => !c.resolvedBy?.[name]).map(name => name === "you" ? humanSeat() ?? name : name) : []; };
  const isIdle = row => row.verified ? row.verified.state === "idle" : (row.activity ?? (row.statusLine?.state === "idle" ? "idle" : null)) === "idle";
  async function nudgeIdle() {
    if (autopilot()) return;
    const now = Date.now();
    for (const row of await meshStatus()) {
      if (!row.session || row.status === "offline" || row.session === sessionId) continue;
      if (!isIdle(row)) { idleSince.delete(row.slug); continue; }
      const since = idleSince.get(row.slug) ?? now;
      idleSince.set(row.slug, since);
      const { items, threads, toResolve } = openWork(row.slug);
      const count = items.length + threads.length + toResolve.length;
      if (!count) { nudgedCount.delete(row.slug); nudged.delete(row.slug); streak.delete(row.slug); continue; }
      if (await waitingOn(row.slug)) continue;
      // Progress since the last nudge (the backlog shrank) earns the next one soon, so the queue drains one by one; otherwise keep the slow pace.
      const progressed = count < (nudgedCount.get(row.slug) ?? 0);
      if (progressed) streak.delete(row.slug);
      const waiting = threads.length + toResolve.length > 0;
      const after = waiting ? NUDGE_THREAD_AFTER : NUDGE_AFTER;
      if (now - since < after || now - (nudgedAt.get(row.slug) ?? 0) < (progressed ? after : backoff(row.slug))) continue;
      // Name the first item not yet nudged at its current version, so a stuck item does not hide the ones behind it. An item comes back when its version
      // changes (a reply, a vote, a new test state) or, once everything has been named, after NUDGE_EVERY.
      if (row.statusLine?.state === "waiting" && Date.parse(row.statusLine.at) > (nudgedAt.get(row.slug) ?? 0)) continue;
      const rate = answerRate();
      const byClosure = list => rank(row.slug, list.map(t => ({ ...t, missing: missingOn(t.id) })), rate).map(({ candidate }) => candidate);
      const candidates = [...byClosure(threads).map(t => ({ key: `t:${t.id}`, version: t.version, thread: t })), ...byClosure(toResolve).map(t => ({ key: `r:${t.id}`, version: t.version, resolve: t })),
        ...items.map(item => ({ key: `q:${item.id}`, version: `${item.state}|${item.run}|${item.weight}`, item }))];
      const seen = nudged.get(row.slug) ?? new Map();
      for (const key of [...seen.keys()]) if (!candidates.some(c => c.key === key)) seen.delete(key);
      let pick = candidates.find(c => seen.get(c.key) !== c.version);
      if (!pick) {
        if (now - (nudgedAt.get(row.slug) ?? 0) < NUDGE_EVERY) continue;
        seen.clear();
        pick = candidates[0];
      }
      seen.set(pick.key, pick.version);
      nudged.set(row.slug, seen);
      const note = `ADR idle nudge: you have been idle ${Math.round((now - since) / 60000)} min with ${items.length} open queue item(s), ${threads.length} thread(s) waiting and ${toResolve.length} to resolve. ` +
        (pick.resolve ? `Thread ${pick.resolve.id.slice(0, 8)} on ${pick.resolve.page} needs your resolve vote (or a reply if you disagree). ` : "") +
        (pick.thread ? `Thread ${pick.thread.id.slice(0, 8)} on ${pick.thread.page} is waiting on you. ` : "") +
        (pick.item ? `Next in your queue: "${pick.item.test}" (rank ${pick.item.rank}${pick.item.weight ? `, weight ${pick.item.weight}` : ""}, ${pick.item.page}). ` : "") +
        "Start it, or say what you wait on with declare_doc_review_waiting (what, minutes) and the nudges stop until then. Each unanswered nudge doubles the gap.";
      nudgedAt.set(row.slug, now);
      nudgedCount.set(row.slug, count);
      streak.set(row.slug, (streak.get(row.slug) ?? 0) + 1);
      const nudgedThread = pick.thread ?? pick.resolve;
      // A failed send keeps nudgedAt, so it is retried at the normal pace instead of every tick, and is not counted as a nudge.
      try { await mesh.send(meshAddress(row).session, note, meshAddress(row).machine); if (nudgedThread) logNudge(row.slug, nudgedThread.id, "idle"); } catch (error) { seen.delete(pick.key); onError?.(error); }
    }
  }
  // One entry for the page, the CLI and the agent tools: request, cast, note or reveal on an effort vote.
  async function voteAction(input, as) {
    const page = input.page, item = input.item;
    if (input.action === "request" || input.request) {
      const requester = as ?? input.requester ?? ownerName();
      const row = requestVotes(root, { page, item, voters: input.voters, requester, deadlineMinutes: input.deadlineMinutes });
      const rows = mesh ? await meshStatus().catch(() => []) : [];
      const asked = [], unreachable = [];
      for (const name of row.rounds.at(-1).requested) {
        const target = rows.find(r => r.slug === name);
        if (!target?.session || target.status === "offline") { unreachable.push(name); continue; }
        const note = `ADR vote request from ${requester}: price ${item} on ${page}. Cast: cast_doc_review_vote(page="${page}", item="${item}", vote=<1|2|3|5|8|13|21>). It is in your queue until you do.`;
        try { await mesh.send(meshAddress(target).session, note, meshAddress(target).machine); asked.push(name); } catch { unreachable.push(name); }
      }
      return { item: publicVotes([row])[0], asked, unreachable };
    }
    const row = input.action === "reveal" || input.reveal ? reveal(root, input) : input.action === "note" || input.note ? addNote(root, { ...input, text: input.note ?? input.text, agent: input.agent ?? as }) : applyVote(root, { ...input, agent: input.agent ?? as });
    return { item: publicVotes([row])[0] };
  }
  const voteTimer = setInterval(() => { try { refreshQueue(root); } catch (error) { onError?.(error); } }, 60_000);
  const nudgeTimer = mesh && process.env.ADR_NUDGE !== "off" ? setInterval(() => nudgeIdle().catch(error => onError?.(error)), 5_000) : undefined;
  nudgeTimer?.unref();
  // .queue-events.jsonl at the site root (one line per test state change): a test turning done hands over to the doers it unblocks;
  // one turning failed or lost alerts its owner and those doers. Reading starts at the end of the file, so old events are not replayed.
  const eventsPath = join(documentRoot, ".queue-events.jsonl");
  let eventsOffset = existsSync(eventsPath) ? statSync(eventsPath).size : 0;
  async function sendQueueEvents() {
    if (!existsSync(eventsPath)) return;
    const size = statSync(eventsPath).size;
    if (size < eventsOffset) eventsOffset = 0;
    if (size === eventsOffset) return;
    const text = readFileSync(eventsPath).subarray(eventsOffset).toString("utf8");
    const end = text.lastIndexOf("\n") + 1;
    eventsOffset += Buffer.byteLength(text.slice(0, end));
    const rows = await meshStatus();
    for (const line of text.slice(0, end).split("\n")) {
      let event; try { event = JSON.parse(line); } catch { continue; }
      const unblocks = event.unblocks ?? [];
      const targets = new Map();
      if (event.state === "done") for (const next of unblocks) targets.set(next.doer, `ADR hand-over (no reply needed): "${event.test}" on ${event.page} is done${event.by ? ` (by ${event.by})` : ""}. Your "${next.id}" is unblocked; it is next in your queue.`);
      else if (event.state === "failed" || event.state === "lost") {
        const note = who => `ADR alert (no reply needed): "${event.test}" on ${event.page} ${event.state}${event.by ? ` (by ${event.by})` : ""}. ${who}`;
        if (event.owner) targets.set(event.owner, note("You own it: decide whether to rerun or stop."));
        for (const next of unblocks) if (!targets.has(next.doer)) targets.set(next.doer, note(`Your "${next.id}" is blocked on it.`));
      }
      for (const [slug, note] of targets) {
        const row = rows.find(candidate => candidate.slug === slug);
        if (!row?.session || row.status === "offline" || row.session === sessionId) continue;
        try { await mesh.send(meshAddress(row).session, note, meshAddress(row).machine); } catch (error) { onError?.(error); }
      }
    }
  }
  const eventsTimer = mesh && process.env.ADR_NUDGE !== "off" ? setInterval(() => sendQueueEvents().catch(error => onError?.(error)), 30_000) : undefined;
  eventsTimer?.unref();
  // A page held in review (open thread or missing verdict) that loses its last blocker: its owner gets one note that it can be set done.
  // The first pass only records which pages are held, so a restart does not re-announce.
  let heldPages;
  async function pingUnblocked() {
    if (!existsSync(join(documentRoot, "queues.json"))) return;
    const cards = pageCards(documentRoot), held = new Set(Object.entries(cards).filter(([, card]) => card.status === "review" && card.reviewFrom).map(([page]) => page));
    const released = heldPages ? [...heldPages].filter(page => !held.has(page) && ["done", "shipped"].includes(cards[page]?.status)) : [];
    heldPages = held;
    if (!released.length) return;
    const rows = await meshStatus();
    for (const page of released) {
      const row = rows.find(candidate => candidate.slug === cards[page].owner);
      if (!row?.session || row.status === "offline" || row.session === sessionId) continue;
      try { await mesh.send(meshAddress(row).session, `ADR unblock ping (no reply needed): ${page} has no blockers left (no open threads, verdict present). Check it and set it done.`, meshAddress(row).machine); } catch (error) { onError?.(error); }
    }
  }
  const unblockTimer = mesh && process.env.ADR_NUDGE !== "off" ? setInterval(() => pingUnblocked().catch(error => onError?.(error)), 30_000) : undefined;
  unblockTimer?.unref();
  // threads.json at the site root (only where queues.json is): open threads with who they wait on, for the queue generator to merge as thread items.
  let threadsTimer;
  const writeThreads = () => {
    threadsTimer = undefined;
    if (!existsSync(join(documentRoot, "queues.json"))) return;
    const rows = [...comments.values()].filter(c => !c.removed && !c.resolved && !c.note && !c.highlight && c.to?.length).map(c => {
      const addressees = [...new Set(c.to.filter(name => !c.muted?.[name]).map(canon))];
      const lastUser = [...c.replies].reverse().find(r => r.author === "user");
      const answered = addressees.filter(name => c.resolvedBy?.[name] || c.replies.some(r => r.author === "copilot" && r.from && canon(r.from) === name && (!lastUser || r.at > lastUser.at)));
      return { id: c.id, page: new URL(c.url).pathname, addressees, answered_by: answered, unresolved_by: addressees.filter(name => !c.resolvedBy?.[name]), at: lastUser?.at ?? c.at };
    }).filter(row => row.unresolved_by.length).sort((a, b) => a.at < b.at ? -1 : 1);
    const text = JSON.stringify(rows, null, 1) + "\n";
    try { if (!existsSync(join(documentRoot, "threads.json")) || readFileSync(join(documentRoot, "threads.json"), "utf8") !== text) writeFileSync(join(documentRoot, "threads.json"), text); } catch { /* read-only root */ }
  };
  const scheduleThreads = () => { threadsTimer ??= setTimeout(writeThreads, 1500); threadsTimer.unref?.(); };
  let api;
  let revision = 0;
  let latestFeedbackId;
  let seenInit = false;
  let agentStatus = { state: "idle", text: "" };
  function apply(record) {
    if (record.event === "comment") {
      const quiet = Boolean(record.highlight || record.note || record.author === "copilot");
      comments.set(record.id, { ...record, seen: quiet, wake: !quiet, readBy: {}, resolved: false, replies: [] });
      if (!quiet) latestFeedbackId = record.id;
    }
    else if (record.event === "queued") {
      const comment = comments.get(record.id);
      if (!comment) throw new Error(`Receipt has no comment: ${record.id}`);
      comment.queued = true;
    } else if (record.event === "seen") {
      for (const id of record.ids) {
        const comment = comments.get(id);
        if (!comment) throw new Error(`Read receipt has no comment: ${id}`);
        if (record.by && record.by !== ownerName()) comment.readBy[record.by] = true;
        else comment.seen = true;
      }
    } else if (record.event === "userseen") {
      // The user has read up to this reply (or "root" for an agent-started thread); shared by every browser.
      for (const [id, key] of Object.entries(record.seen)) if (comments.has(id)) comments.get(id).userSeen = key;
      seenInit = true;
    } else if (record.event === "update") {
      const comment = comments.get(record.commentId);
      if (!comment) throw new Error(`Update has no comment: ${record.commentId}`);
      updates.set(record.id, record);
      comment.updatedAt = record.at;
      if (record.reply !== undefined) {
        comment.replies.push({
          id: record.id, at: record.at, author: record.author, comment: record.reply,
          ...(record.note ? { note: true } : {}),
          ...(record.inReplyTo ? { inReplyTo: record.inReplyTo } : {}),
          ...(record.from ? { from: record.from } : {}),
          ...(record.to?.length ? { to: record.to } : {}),
          ...(record.whisper && record.to?.length ? { whisper: true } : {}),
          ...(record.proposal ? { proposal: record.proposal } : {}),
          ...(record.images?.length ? { images: record.images } : {}),
        });
      }
      let wake = (record.reply !== undefined && !record.note) || record.resolved !== undefined;
      if (record.promote) { comment.note = false; wake = true; }
      if (record.editComment !== undefined) {
        comment.comment = record.editComment;
        comment.commentEdited = true;
        wake ||= !comment.note;
      }
      if (record.editReply) {
        const target = comment.replies.find(item => item.id === record.editReply.id);
        if (target) {
          target.comment = record.editReply.text;
          target.edited = true;
          wake ||= !target.note && !comment.note;
        }
      }
      if (record.addImages) {
        comment.images = [...new Set([...(comment.images || []), ...record.addImages])];
        wake = true;
      }
      if (record.removeImages) comment.images = (comment.images || []).filter(id => !record.removeImages.includes(id));
      if (record.addRefs) comment.refs = [...new Set([...(comment.refs || []), ...record.addRefs])];
      if (record.removeRefs) comment.refs = (comment.refs || []).filter(id => !record.removeRefs.includes(id));
      if (record.removeReply) comment.replies = comment.replies.filter(item => item.id !== record.removeReply);
      if (record.resolved !== undefined) {
        // Each addressee resolves for itself, and so does the user (`you`); the thread closes when every addressee has. The user's mark is recorded only with `partial` (older records, which replay on start, closed for all); `closeAll` closes it for all, and reopening clears everyone's mark.
        const who = record.author === "copilot" && record.from ? canon(record.from) : null;
        const need = seatsIn(comment);
        // Threads opened before USER_MARK_FROM keep the old rule (addressees only), so history does not reopen.
        const mark = who && need.includes(who) ? who : record.author === "user" && record.partial && need.length ? "you" : null;
        if (mark && record.resolved) {
          comment.resolvedBy = { ...comment.resolvedBy, [mark]: record.at };
          const done = (comment.at >= USER_MARK_FROM ? [...need, "you"] : need).every(name => comment.resolvedBy[name]);
          if (done && !comment.resolved) comment.resolvedAt = record.at;
          comment.resolved = done;
        } else if (mark === who && who && !record.resolved) {
          delete comment.resolvedBy?.[who];
          comment.resolved = false;
        } else if (!record.resolved && record.partial && !comment.resolved) {
          delete comment.resolvedBy?.you;
        } else {
          if (record.resolved && !comment.resolved) comment.resolvedAt = record.at;
          comment.resolved = record.resolved;
          if (!record.resolved) delete comment.resolvedBy;
        }
      }
      // A new message that addresses someone who had resolved clears their mark and reopens the thread for them.
      if (record.reply !== undefined && !record.note && record.resolved === undefined && record.to?.length && comment.resolvedBy) {
        const cleared = record.to.map(canon).filter(name => comment.resolvedBy[name]);
        for (const name of cleared) delete comment.resolvedBy[name];
        if (cleared.length && comment.resolved) { comment.resolved = false; delete comment.resolvedAt; }
      }
      // A thread is a room: addressees accumulate as members, and `to` on a reply only says whom to ping.
      // Older records replay with the old rule (the last `to` is the member list), so history does not add people to threads they left.
      if (record.to) comment.to = record.at >= ROOMS_FROM ? [...new Set([...(comment.to ?? []), ...record.to])] : record.to;
      if (typeof record.mute === "boolean") {
        const name = record.author === "copilot" && record.from ? canon(record.from) : humanSeat() ?? "you";
        comment.muted = { ...comment.muted };
        if (record.mute) comment.muted[name] = true; else delete comment.muted[name];
      }
      if (record.color !== undefined) comment.color = record.color;
      if (record.removed !== undefined) comment.removed = record.removed;
      if (record.clear) Object.assign(comment, { comment: "", note: false, highlight: true, replies: [], resolved: false, seen: true });
      if (record.author === "user" && wake) {
        comment.seen = false;
        comment.wake = true;
        comment.readBy = {};
        latestFeedbackId = record.id;
      }
    } else throw new Error(`Unknown comment-log event: ${record.event}`);
    revision++;
    scheduleThreads();
  }
  for (const record of records) apply(record);
  const token = randomUUID();

  // A drawn region: child-index path from the page body to an element, and the rectangle as fractions of that element.
  function regionField(value) {
    if (!value || !Array.isArray(value.path) || value.path.length > 32 || !value.path.every(n => Number.isInteger(n) && n >= 0 && n < 100000)) return null;
    if (!Array.isArray(value.box) || value.box.length !== 4 || !value.box.every(n => Number.isFinite(n) && Math.abs(n) < 1000)) return null;
    return { path: value.path, box: value.box };
  }
  function imageIds(value) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > MAX_IMAGES) throw new Error(`images must list at most ${MAX_IMAGES} attachments.`);
    return [...new Set(value.map(id => {
      if (typeof id !== "string" || !IMAGE_ID.test(id) || !existsSync(imageFile(id))) throw new Error("Unknown image attachment.");
      return id;
    }))];
  }
  function saveImage(bytes) {
    if (bytes.length < PNG.length || !bytes.subarray(0, PNG.length).equals(PNG)) throw new Error("Attachments must be PNG images.");
    const id = createHash("sha256").update(bytes).digest("hex");
    if (!existsSync(imageFile(id))) writeFileSync(imageFile(id), bytes, { mode: 0o600 });
    return id;
  }
  const withFiles = comment => comment.images?.length || comment.replies?.some(reply => reply.images?.length)
    ? { ...comment, ...(comment.images?.length ? { imageFiles: comment.images.map(imageFile) } : {}),
        replies: comment.replies.map(reply => reply.images?.length ? { ...reply, imageFiles: reply.images.map(imageFile) } : reply) } : comment;

  function unread(as = ownerName()) {
    return [...comments.values()].filter(comment => comment.wake && addressed(comment, as) && !readBy(comment, as));
  }

  function normalize(input) {
    if (input.sessionId !== sessionId) throw new Error("The receiving session changed. Reload before sending.");
    const id = identifier(input.id, "Comment ID");
    if (updates.has(id)) throw new CommentConflict("This ID already identifies a thread update.");
    const url = new URL(field(input.url, "Page URL", 2048));
    const preview = new URL(previewOrigin);
    // The same server may be opened as NAME.localhost:port or localhost:port; comments keep one canonical origin.
    if (url.port === preview.port && url.protocol === preview.protocol && /^(127\.0\.0\.1|localhost|[a-z0-9-]+\.localhost)$/.test(url.hostname)) url.host = preview.host;
    if (url.origin !== previewOrigin) throw new Error("The page is not the configured preview.");
    const pathname = decodeURIComponent(url.pathname).replace(/\.html$/, "");
    const stem = resolve(root, "." + pathname);
    const source = realpathSync(pathname.endsWith("/") ? join(stem, "index.md") : stem + ".md");
    const within = relative(root, source);
    if (isAbsolute(within) || within === ".." || within.startsWith(".." + sep)) {
      throw new Error("The document is outside the preview root.");
    }
    if (!["text", "equation", "figure", "node", "edge", "page", "session"].includes(input.kind)) throw new Error("Invalid comment target.");
    const images = imageIds(input.images);
    const refs = Array.isArray(input.refs) ? [...new Set(input.refs.filter(ref => typeof ref === "string" && comments.has(ref)))].slice(0, 20) : [];
    return {
      id, url: url.href, source,
      section: field(input.section, "Section", 512),
      anchor: typeof input.anchor === "string" ? input.anchor.slice(0, 256) : "",
      kind: input.kind,
      quote: field(input.quote, "Selected content", 4096),
      comment: input.highlight === true && !input.comment ? "" : field(input.comment, "Comment", 8192),
      ...(input.highlight === true ? { highlight: true } : {}),
      ...(input.note === true && input.highlight !== true ? { note: true } : {}),
      color: COLORS.includes(input.color) ? input.color : "yellow",
      ...(typeof input.person === "string" && /^[\w .-]{1,40}$/.test(input.person) ? { person: input.person } : {}),
      ...(images.length ? { images } : {}),
      ...(input.queued === true ? { queued: true } : {}),
      ...(regionField(input.region) ? { region: regionField(input.region) } : {}),
      ...(refs.length ? { refs } : {}),
      ...(names(input.to, "to")?.length || mentioned(input.comment).length ? { to: [...new Set([...(names(input.to, "to") ?? []), ...mentioned(input.comment)])].slice(0, 12) } : {}),
    };
  }

  // The page and mesh notes show 8-character ids; accept a unique prefix of a thread id.
  function resolveCommentId(value) {
    const text = field(value, "Comment ID", 36).toLowerCase();
    if (/^[\da-f]{8}(-[\da-f-]{0,27})?$/.test(text) && text.length < 36) {
      const hits = [...comments.keys()].filter(id => id.startsWith(text));
      if (hits.length === 1) return hits[0];
      throw new Error(hits.length ? `Comment id prefix '${text}' is ambiguous; use more characters.` : "The comment does not exist in this session.");
    }
    return identifier(value, "Comment ID");
  }

  function normalizeUpdate(input, author) {
    if (!["user", "copilot"].includes(author)) throw new Error("Invalid reply author.");
    if (author === "user" && input.sessionId !== sessionId) {
      throw new Error("The receiving session changed. Reload before sending.");
    }
    const value = {
      id: identifier(input.id, "Update ID"),
      commentId: resolveCommentId(input.commentId), author,
    };
    if (comments.has(value.id)) throw new CommentConflict("This update ID already identifies a comment.");
    if (!comments.has(value.commentId)) throw new Error("The comment does not exist in this session.");
    if (Object.hasOwn(input, "reply")) value.reply = field(input.reply, "Reply", 8192);
    if (value.reply !== undefined && input.inReplyTo && typeof input.inReplyTo === "object") {
      const target = identifier(input.inReplyTo.id, "Reply target ID");
      const thread = comments.get(value.commentId);
      if (target !== thread.id && !thread.replies.some(reply => reply.id === target)) throw new Error("The replied-to message is not in this thread.");
      value.inReplyTo = { id: target, quote: String(input.inReplyTo.quote ?? "").slice(0, 600) };
    }
    if (Object.hasOwn(input, "resolved")) {
      if (typeof input.resolved !== "boolean") throw new Error("Resolved must be a boolean.");
      value.resolved = input.resolved;
    }
    if (names(input.to, "to")?.length) value.to = names(input.to, "to");
    if (typeof input.mute === "boolean") value.mute = input.mute;
    if (value.reply !== undefined && !input.note) {
      const members = comments.get(value.commentId).to ?? [];
      const extra = mentioned(value.reply).filter(name => !(value.to ?? members).map(canon).includes(name));
      if (extra.length) value.to = [...new Set([...(value.to ?? members.filter(name => !comments.get(value.commentId).muted?.[name])).map(canon), ...extra])].slice(0, 12);
    }
    if (input.whisper === true && value.to?.length && value.reply !== undefined) value.whisper = true;
    if (author === "user" && COLORS.includes(input.color)) value.color = input.color;
    if (author === "user" && input.clear === true) value.clear = true;
    if (author === "user" && value.reply !== undefined && input.images !== undefined) {
      const ids = imageIds(input.images);
      if (ids.length) value.images = ids;
    }
    if (author === "user" && input.closeAll === true) value.closeAll = true;
    if (author === "user" && input.partial === true) value.partial = true;
    if (author === "user" && input.note === true && value.reply !== undefined) value.note = true;
    if (author === "user" && input.promote === true) value.promote = true;
    if (author === "user" && input.queued === true) value.queued = true;
    if (author === "user" && Object.hasOwn(input, "editComment")) value.editComment = field(input.editComment, "Comment", 8192);
    if (author === "user" && input.editReply) {
      value.editReply = { id: identifier(input.editReply.id, "Reply ID"), text: field(input.editReply.text, "Reply", 8192) };
    }
    if (author === "user" && input.addImages !== undefined) {
      const ids = imageIds(input.addImages);
      if (ids.length) value.addImages = ids;
    }
    if (author === "user" && Array.isArray(input.removeImages)) {
      const ids = input.removeImages.filter(id => typeof id === "string" && IMAGE_ID.test(id)).slice(0, MAX_IMAGES);
      if (ids.length) value.removeImages = ids;
    }
    for (const [key, name] of [["addRefs", "addRefs"], ["removeRefs", "removeRefs"]]) {
      if (input[key] === undefined) continue;
      if (!Array.isArray(input[key]) || input[key].length > 20) throw new Error(`${name} must list at most 20 comment IDs.`);
      const ids = [...new Set(input[key].map(id => identifier(id, "Linked comment ID")))];
      if (name === "addRefs" && ids.some(id => id === value.commentId || !comments.has(id))) throw new Error("Linked comments must be other threads in this session.");
      if (ids.length) value[name] = ids;
    }
    if (author === "copilot" && typeof input.from === "string" && /^[\w .@-]{1,60}$/.test(input.from.trim())) value.from = input.from.trim();
    // No `as`: name the sender by its session in the team roster.
    if (author === "copilot" && !value.from && typeof input.fromSession === "string") {
      const row = rowForSession(input.fromSession);
      // The slug, not the display name, so resolve marks and unanswered checks match the roster.
      if (row?.slug) value.from = String(row.slug).slice(0, 60);
      // A session missing from the roster would be recorded as "copilot", and its resolve votes would count for nobody.
      else if (agents().length) throw new Error("This session is not in the team roster, so the update cannot be attributed. Pass as: your agent slug.");
    }
    if (author === "copilot" && input.proposal && typeof input.proposal === "object") {
      value.proposal = { before: String(input.proposal.before ?? "").slice(0, 8000), after: String(input.proposal.after ?? "").slice(0, 8000) };
      value.reply ??= "Proposed edit:";
    }
    if (author === "user" && input.removeReply) value.removeReply = identifier(input.removeReply, "Reply ID");
    if (author === "user" && typeof input.removed === "boolean") value.removed = input.removed;
    if (value.reply === undefined && value.resolved === undefined && value.color === undefined && value.removed === undefined && !value.clear &&
        !value.promote && value.editComment === undefined && !value.editReply && !value.removeReply &&
        !value.to && value.mute === undefined && !value.addImages && !value.removeImages && !value.addRefs && !value.removeRefs) {
      throw new Error("An update needs a reply, resolved state, colour, image, link, edit or removal.");
    }
    const previous = updates.get(value.id);
    if (previous && JSON.stringify(previous.input) !== JSON.stringify(value)) {
      throw new CommentConflict("This update ID already has different content.");
    }
    return value;
  }

  // An agent's reply is announced like a user's: to the addressees it names, else the thread's, never to the sender.
  function agentUpdate(body) {
    const value = normalizeUpdate(body, "copilot");
    const fresh = !updates.has(value.id);
    const result = saveUpdate(value);
    if (fresh && value.reply !== undefined && !value.note) announce(comments.get(value.commentId), value.reply, false, value.to, value.from);
    return result;
  }

  function saveUpdate(input) {
    if (!updates.has(input.id)) {
      const record = { ...input, input, event: "update", at: new Date().toISOString() };
      append(log, record);
      apply(record);
    }
    return {
      id: input.id, commentId: input.commentId, saved: true, revision,
      resolved: comments.get(input.commentId).resolved,
      // Who has resolved, so a vote that was saved but not counted shows up in the answer.
      resolvedBy: Object.keys(comments.get(input.commentId).resolvedBy ?? {}),
    };
  }

  // Threads whose last word is the user's, with nothing from an agent since. Read-only: leaves read receipts alone.
  function unansweredFor(as) {
    const now = Date.now();
    const rows = [...comments.values()].filter(comment => !comment.removed && !comment.resolved && !comment.note && !comment.highlight && addressed(comment, as) && !comment.resolvedBy?.[as]).flatMap(comment => {
      const last = comment.replies.at(-1) ?? { author: comment.author ?? "user", comment: comment.comment, at: comment.at, to: comment.to };
      if (last.author !== "user") return [];
      if (comment.muted?.[as] && !(last.to ?? []).map(canon).includes(as)) return [];
      const text = (last.reply ?? last.comment ?? "").replace(/\s+/g, " ");
      return [{ id: comment.id, version: String(last.at || comment.at), page: new URL(comment.url).pathname, ageMinutes: Math.round((now - Date.parse(last.at || comment.at)) / 60000), quote: text.length > 140 ? `${text.slice(0, 140)}…` : text }];
    }).sort((a, b) => b.ageMinutes - a.ageMinutes);
    // Open threads addressed to this agent whose last word is an agent's, so nothing is left to answer but its resolve vote is still missing.
    const toResolve = [...comments.values()].filter(comment => !comment.removed && !comment.resolved && !comment.note && !comment.highlight && comment.to?.length && addressed(comment, as) && !comment.muted?.[as] && !comment.resolvedBy?.[as] && !rows.some(row => row.id === comment.id))
      .map(comment => ({ id: comment.id, version: `${comment.replies.at(-1)?.at ?? comment.at}|${Object.keys(comment.resolvedBy ?? {}).length}`, page: new URL(comment.url).pathname }));
    return { checked: `${rows.length} unanswered, ${toResolve.length} to resolve`, as, threads: rows, toResolve, ...(autopilot() ? { autopilot: autopilotNote() } : {}) };
  }
  function readAs(as, includeSeen = false) {
    const rows = unread(as);
    // A whisper is shown only to the agents it names; to everyone else the thread reads as if it was never said.
    const hideWhispers = comment => comment.replies.some(reply => reply.whisper && !reply.to.includes(as)) ? { ...comment, replies: comment.replies.filter(reply => !reply.whisper || reply.to.includes(as)) } : comment;
    const result = (includeSeen ? [...comments.values()].filter(comment => addressed(comment, as)) : rows).map(withFiles).map(hideWhispers);
    if (rows.length) {
      const receipt = { event: "seen", ids: rows.map(comment => comment.id), by: as, at: new Date().toISOString() };
      append(log, receipt);
      apply(receipt);
    }
    return result;
  }

  const touchedBy = new Map();
  try {
    for (const line of readFileSync(join(data, "touches.jsonl"), "utf8").split("\n")) {
      if (!line) continue;
      const { path, agent } = JSON.parse(line);
      touchedBy.set(path, new Set([...(touchedBy.get(path) ?? []), agent]));
    }
  } catch { /* no footprints yet */ }
  const server = createServer(async (request, response) => {
    let saved = false;
    try {
      if (request.headers.authorization !== `Bearer ${token}`) {
        return reply(response, 403, { error: "Unauthorized comment bridge request." });
      }
      if (request.method === "GET" && request.url === "/status") {
        return reply(response, 200, { sessionId, pendingCount: unread().length, agent: agentStatus });
      }
      if (request.method === "GET" && request.url === "/history") {
        return reply(response, 200, { sessionId, revision, seenInit, comments: [...comments.values()] });
      }
      // Open threads and anything touched in the last 14 days; the rest is fetched with /history when needed.
      if (request.method === "GET" && request.url === "/history-recent") {
        const cutoff = Date.now() - 14 * 86400000;
        const all = [...comments.values()];
        const recent = all.filter(c => !c.resolved || Date.parse(c.updatedAt || c.at) >= cutoff);
        return reply(response, 200, { sessionId, revision, seenInit, comments: recent, archived: all.length - recent.length });
      }
      if ((request.url === "/viewed" || request.url === "/whatsnew") && (request.method === "GET" || (request.method === "POST" && request.url === "/viewed"))) {
        const pages = readPageTree(root, { grouped: false });
        const now = Object.fromEntries(pages.map(page => [page.link, { slug: page.slug, hash: createHash("sha1").update(readFileSync(join(root, page.slug + ".md"))).digest("hex") }]));
        const file = join(data, "viewed.json");
        let seen = {};
        try { seen = JSON.parse(readFileSync(file, "utf8")); } catch { /* first use: everything now counts as viewed */ }
        const save = () => writeFileSync(file, JSON.stringify(seen), { mode: 0o600 });
        // The copy you last viewed, so "What's new" can show what changed since then.
        const snapDir = join(data, "snapshots");
        const snapFile = row => join(snapDir, row.slug.replace(/[^\w.-]+/g, "__") + ".md");
        const snapshot = row => { mkdirSync(snapDir, { recursive: true }); copyFileSync(join(root, row.slug + ".md"), snapFile(row)); };
        if (!existsSync(file)) { seen = Object.fromEntries(Object.entries(now).map(([link, row]) => [link, row.hash])); save(); Object.values(now).forEach(snapshot); }
        if (request.method === "GET" && request.url === "/whatsnew") {
          const changed = Object.entries(now).filter(([link, row]) => seen[link] !== row.hash).map(([link, row]) => {
            const before = existsSync(snapFile(row)) ? readFileSync(snapFile(row), "utf8") : undefined;
            const rows = diffLines(seen[link] === undefined ? undefined : before, readFileSync(join(root, row.slug + ".md"), "utf8"));
            const front = readFileSync(join(root, row.slug + ".md"), "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
            const card = Object.fromEntries(["line", "state", "next"].map(k => [k, front.match(new RegExp(`^card-${k}:\\s*(.+)$`, "m"))?.[1].trim().replace(/^["']|["']$/g, "")]).filter(([, v]) => v));
            return {
              card, link, slug: row.slug, state: seen[link] === undefined ? "new" : "changed", noCopy: seen[link] !== undefined && before === undefined,
              changedAt: statSync(join(root, row.slug + ".md")).mtime.toISOString(),
              added: rows.filter(r => r.op === "+").length, removed: rows.filter(r => r.op === "-").length,
              hunks: hunks(rows).slice(0, 40)
            };
          }).sort((x, y) => y.changedAt.localeCompare(x.changedAt));
          return reply(response, 200, { pages: changed });
        }
        if (request.method === "POST") {
          const body = [];
          for await (const chunk of request) { body.push(chunk); if (body.length > 64) break; }
          let link, all;
          try { ({ path: link, all } = JSON.parse(Buffer.concat(body).toString("utf8"))); } catch { return reply(response, 400, { error: "Invalid JSON." }); }
          if (all === true) for (const [key, row] of Object.entries(now)) { seen[key] = row.hash; snapshot(row); }
          const key = typeof link === "string" ? link.replace(/\.html$/, "").replace(/\/index$/, "/") || "/" : "";
          const hit = now[key] ? key : now[key + "/"] ? key + "/" : undefined;
          if (hit) { seen[hit] = now[hit].hash; snapshot(now[hit]); }
          save();
        }
        return reply(response, 200, { pages: Object.fromEntries(Object.entries(now).flatMap(([link, row]) => seen[link] === undefined ? [[link, "new"]] : seen[link] !== row.hash ? [[link, "changed"]] : [])) });
      }
      // Comments as labelled examples: the passage, what was said, by whom, on which version of the page, and the last agent answer (the fix).
      if (request.method === "GET" && request.url === "/labels") {
        const rows = [...comments.values()].filter(c => !c.removed && c.comment).map(c => ({
          id: c.id, page: c.url ? new URL(c.url).pathname : "", quote: c.quote, text: c.comment, person: c.person ?? null,
          version: c.sourceHash ?? null, at: c.at, resolved: Boolean(c.resolved),
          fix: [...(c.replies ?? [])].reverse().find(r => r.author !== "user")?.reply ?? null,
        }));
        response.writeHead(200, { "content-type": "application/x-ndjson" });
        return response.end(rows.map(row => JSON.stringify(row)).join("\n") + "\n");
      }
      // Pages that say which threads they came from (`from: <thread id, 8+ chars>` or a list) and who wrote them (`author:`).
      if (request.method === "GET" && request.url === "/pagelinks") {
        const result = {};
        for (const page of readPageTree(root, { grouped: false })) {
          let head = "";
          try { head = (/^---\n([\s\S]*?)\n---/.exec(readFileSync(join(root, page.slug + ".md"), "utf8")) || [])[1] || ""; } catch { continue; }
          const field = name => (new RegExp(`^${name}:[ \\t]*(.*)$`, "m").exec(head) || [])[1]?.trim().replace(/^\[|\]$/g, "");
          const from = (field("from") || "").split(/[ ,]+/).map(id => id.replace(/^["']|["']$/g, "")).filter(id => /^[0-9a-f-]{8,36}$/i.test(id));
          const author = (field("author") || "").replace(/^["']|["']$/g, "");
          const list = name => (field(name) || "").split(/\s*,\s*/).map(v => v.replace(/^["']|["']$/g, "")).filter(Boolean);
          const people = new Set([...list("owner"), ...list("card-owner"), ...list("participants"), author].filter(Boolean));
          for (const name of touchedBy.get(page.link) ?? []) people.add(name);
          for (const comment of comments.values()) {
            if (comment.removed || !comment.url || new URL(comment.url).pathname.replace(/\.html$/, "").replace(/\/index$/, "/") !== page.link) continue;
            for (const message of [comment, ...(comment.replies ?? [])]) if (message.from) people.add(message.from);
          }
          const owner = (field("owner") || list("card-owner")[0] || "").replace(/^["']|["']$/g, "");
          const partners = list("participants");
          if (from.length || author || people.size) result[page.link] = { title: page.title, author: author || undefined, owner: owner || undefined, partners: partners.length ? partners : undefined, from, participants: [...people] };
        }
        return reply(response, 200, { pages: result });
      }
      // A harness footprint: whoever touches a page (edit, run, comment) reports its name, so the page's participants fill themselves in.
      if (request.method === "POST" && request.url === "/touch") {
        const body = [];
        for await (const chunk of request) { body.push(chunk); if (body.length > 16) break; }
        let input;
        try { input = JSON.parse(Buffer.concat(body).toString("utf8")); } catch { return reply(response, 400, { error: "Invalid JSON." }); }
        const link = typeof input.path === "string" ? input.path.replace(/\.html$/, "").replace(/\/index$/, "/").replace(/(.)\/$/, "$1") : "";
        const agent = typeof input.agent === "string" ? input.agent.trim().slice(0, 64) : "";
        if (!link.startsWith("/") || !agent) return reply(response, 400, { error: "Need path (/page) and agent." });
        append(join(data, "touches.jsonl"), { path: link, agent, at: new Date().toISOString() });
        touchedBy.set(link, new Set([...(touchedBy.get(link) ?? []), agent]));
        return reply(response, 200, { ok: true });
      }
      if (request.method === "GET" && request.url === "/votes") return reply(response, 200, { votes: publicVotes(readVotes(root)) });
      if (request.method === "POST" && request.url === "/vote") {
        const body = [];
        for await (const chunk of request) { body.push(chunk); if (body.length > 16) break; }
        try {
          const input = JSON.parse(Buffer.concat(body).toString("utf8"));
          return reply(response, 200, { ok: true, ...(await voteAction(input)) });
        } catch (error) { return reply(response, 400, { error: error.message }); }
      }
      if (request.method === "GET" && request.url === "/settings") return reply(response, 200, effective());
      if (request.method === "POST" && request.url === "/bell") {
        // Call for resolution: tell every addressee who has not resolved the thread, now, whatever the nudge pacing says.
        const body = [];
        for await (const chunk of request) { body.push(chunk); if (body.length > 16) break; }
        let input;
        try { input = JSON.parse(Buffer.concat(body).toString("utf8")); } catch { return reply(response, 400, { error: "Invalid JSON." }); }
        const comment = comments.get(input.id);
        if (!comment || comment.removed || comment.resolved) return reply(response, 404, { error: "No open thread with that id." });
        if (!mesh) return reply(response, 409, { error: "The mesh is not connected." });
        const rows = await meshStatus();
        const page = new URL(comment.url).pathname;
        const rung = [], unreachable = [], reasons = {};
        for (const name of missingOn(comment.id)) {
          const row = rows.find(r => r.slug === name);
          if (!row?.session || row.status === "offline") { unreachable.push(name); continue; }
          const note = `ADR call for resolution (thread ${comment.id.slice(0, 8)} on ${page}): the user is waiting for your resolve vote on this thread. ` +
            `Resolve it, or reply with what blocks it. Read: read_doc_review_comments; reply or vote resolve: update_doc_review_comment(comment_id="${comment.id}").`;
          try { await mesh.send(meshAddress(row).session, note, meshAddress(row).machine); logNudge(name, comment.id, "bell"); rung.push(name); } catch (error) { unreachable.push(name); reasons[name] = error.message; }
        }
        return reply(response, 200, { ok: true, rung, unreachable, reasons });
      }
      if (request.method === "GET" && request.url === "/itemturns") {
        // Queue item → the interaction where each agent on this machine first met it, and how many items map to none. Remote agents are skipped.
        const queues = readQueues(), out = {};
        for (const row of (await meshStatus()).filter(r => r.session && (!r.machine || r.machine === hostname()))) {
          const items = queues[row.slug] ?? [];
          if (!items.length) continue;
          try { out[row.slug] = itemTurns(readFileSync(join(homedir(), ".copilot", "session-state", row.session, "events.jsonl"), "utf8").split("\n"), items); } catch { /* no log for this session */ }
        }
        return reply(response, 200, { agents: out });
      }
      if (request.method === "GET" && request.url === "/ceremony") {
        try { return reply(response, 200, JSON.parse(readFileSync(join(documentRoot, "ceremony.json"), "utf8"))); } catch { return reply(response, 200, { rows: [] }); }
      }
      if (request.method === "GET" && request.url === "/latency") {
        // How long your messages wait for an answer, and how long threads stay open, per thread and per addressed agent (minutes). For the ceremony stats.
        const minutes = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 6000) / 10;
        const median = values => values.length ? [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)] : null;
        const threads = [...comments.values()].filter(comment => !comment.removed && !comment.note && !comment.highlight && comment.kind !== "session").map(comment => {
          const messages = [{ user: true, at: comment.at }, ...comment.replies.map(reply => ({ user: reply.author === "user", at: reply.at }))].filter(message => message.at);
          const answers = [];
          messages.forEach((message, index) => {
            if (!message.user || messages[index - 1]?.user) return;
            const answer = messages.slice(index + 1).find(next => !next.user);
            if (answer) answers.push(minutes(message.at, answer.at));
          });
          return { id: comment.id, page: new URL(comment.url).pathname, to: (comment.to ?? []).map(canon), answerMinutes: answers, resolveMinutes: comment.resolved && comment.resolvedAt ? minutes(comment.at, comment.resolvedAt) : null };
        });
        const perAgent = {};
        for (const thread of threads) for (const agent of thread.to) {
          const entry = perAgent[agent] ??= { answer: [], resolve: [] };
          entry.answer.push(...thread.answerMinutes);
          if (thread.resolveMinutes !== null) entry.resolve.push(thread.resolveMinutes);
        }
        return reply(response, 200, {
          threads,
          agents: Object.fromEntries(Object.entries(perAgent).map(([agent, entry]) => [agent, { answers: entry.answer.length, medianAnswerMinutes: median(entry.answer), resolved: entry.resolve.length, medianResolveMinutes: median(entry.resolve) }])),
        });
      }
      if (request.method === "GET" && request.url === "/rooms") {
        // Read-only view of every room; it never touches read_through, so viewing marks nothing read.
        const names = new Map(roster().filter(row => row.session).map(row => [row.session, row.slug]));
        const who = id => names.get(bareSession(id)) ?? bareSession(id).slice(0, 8);
        try {
          const db = new DatabaseSync(process.env.ADR_MESH_DB || join(meshDataDirectory(), "agent-mesh.db"), { readOnly: true });
          try {
            const rooms = db.prepare("SELECT face_id, topic, created_at FROM mesh_faces ORDER BY created_at DESC").all().map(room => {
              const posts = db.prepare("SELECT post_id, sender_session_id, content, created_at FROM mesh_face_posts WHERE face_id = ? ORDER BY post_id").all(room.face_id).map(post => ({ id: post.post_id, from: who(post.sender_session_id), content: post.content, at: post.created_at }));
              const summary = posts.findLast(post => /^SUMMARY:/i.test(post.content));
              const closed = posts.findLast(post => /^CLOSED:/i.test(post.content));
              return {
                id: room.face_id, topic: room.topic, opened: room.created_at,
                members: db.prepare("SELECT session_id FROM mesh_face_members WHERE face_id = ?").all(room.face_id).map(member => who(member.session_id)),
                summary: summary ? { from: summary.from, at: summary.at, text: summary.content.replace(/^SUMMARY:\s*/i, "") } : null,
                closed: closed ? { at: closed.at, text: closed.content.replace(/^CLOSED:\s*/i, "") } : null,
                postCount: posts.length, posts: posts.slice(-20),
              };
            });
            return reply(response, 200, { rooms });
          } finally { db.close(); }
        } catch (error) { return reply(response, 200, { rooms: [], error: error.message }); }
      }
      const faceRoute = request.method === "GET" && /^\/faces(?:\/([\w-]{1,64}))?$/.exec(request.url);
      if (faceRoute) {
        try {
          if (!mesh?.faces) return reply(response, 200, { faces: [] });
          const faces = await mesh.faces();
          if (!faceRoute[1]) return reply(response, 200, { self: faces.self, ...faces.status() });
          const log = faces.log(faceRoute[1]);
          if (log.error) return reply(response, 404, log);
          faces.read(faceRoute[1]);
          return reply(response, 200, { self: faces.self, ...log });
        } catch (error) { return reply(response, 503, { error: error.message }); }
      }
      if (request.method === "GET" && request.url === "/mesh") {
        let queues = {};
        try { queues = JSON.parse(readFileSync(join(documentRoot, "queues.json"), "utf8")); } catch { /* no queues.json */ }
        const members = (await meshStatus()).map(row => {
          if (!row.session) return row;
          const open = (queues[row.slug] ?? []).filter(item => item.state !== "done").length + unansweredFor(row.slug).threads.length + unansweredFor(row.slug).toResolve.length;
          return { ...row, open, idleMinutes: isIdle(row) && idleSince.has(row.slug) ? Math.round((Date.now() - idleSince.get(row.slug)) / 60000) : 0 };
        });
        return reply(response, 200, { queues, members, edges: meshEdges, machines: await machines(), errors: Object.fromEntries(remoteErrors) });
      }
      const unansweredRoute = request.method === "GET" && /^\/unanswered\?(.*)$/.exec(request.url);
      if (unansweredRoute) {
        const as = nameFor(new URLSearchParams(unansweredRoute[1]).get("as") || ownerName());
        if (!NAME.test(as)) return reply(response, 400, { error: "Invalid agent name." });
        return reply(response, 200, unansweredFor(as));
      }
      const readRoute = request.method === "GET" && /^\/read\?(.*)$/.exec(request.url);
      if (readRoute) {
        const query = new URLSearchParams(readRoute[1]);
        const as = nameFor(query.get("as") || ownerName());
        if (!NAME.test(as)) return reply(response, 400, { error: "Invalid agent name." });
        // With a roster, an unknown name would silently read nothing; say which names exist instead.
        if (query.get("as") && agents().length && !teamNames().includes(as)) return reply(response, 400, { error: `Unknown agent "${as}". Use as=<name> from the team page: ${teamNames().join(", ")} (or your session id).` });
        return reply(response, 200, { sessionId, comments: readAs(as, query.get("includeSeen") === "1") });
      }
      const spoken = request.method === "GET" && /^\/tts\/([\da-f]{64})$/.exec(request.url);
      if (spoken) {
        const file = join(speechDir, spoken[1] + ".wav");
        if (!existsSync(file)) return reply(response, 404, { error: "Unknown audio." });
        response.writeHead(200, { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=31536000, immutable" });
        return response.end(readFileSync(file));
      }
      const download = request.method === "GET" && /^\/attachments\/([\da-f]{64})$/.exec(request.url);
      if (download) {
        if (!existsSync(imageFile(download[1]))) return reply(response, 404, { error: "Unknown image attachment." });
        response.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "private, max-age=31536000, immutable" });
        return response.end(readFileSync(imageFile(download[1])));
      }
      if (request.method !== "POST" || !["/comments", "/updates", "/attachments", "/userseen", "/settings", "/agent-update", "/agent-add", "/agent-status", "/agent-vote", "/agent-waiting", "/face-open", "/face-post", "/restart", "/tts", "/table-edit"].includes(request.url)) {
        return reply(response, 404, { error: "Unknown comment endpoint." });
      }
      if (request.url === "/restart") {
        if (!onRestart) return reply(response, 501, { error: "This server was not started with `adr`, so it cannot restart itself. Restart it from its agent session." });
        reply(response, 200, { restarting: true });
        setTimeout(onRestart, 200);
        return;
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > (request.url === "/attachments" ? MAX_IMAGE_BYTES : 24_576)) {
          return reply(response, 413, { error: "Comment request is too large." });
        }
        chunks.push(chunk);
      }
      if (request.url === "/tts") {
        try {
          return reply(response, 200, { id: await speech(JSON.parse(Buffer.concat(chunks).toString("utf8")).text) });
        } catch (error) {
          return reply(response, 503, { error: error.message });
        }
      }
      if (request.url === "/table-edit") {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          const url = new URL(field(body.url, "Page URL", 2048));
          const pathname = decodeURIComponent(url.pathname).replace(/\.html$/, "");
          const stem = resolve(root, "." + pathname);
          const source = realpathSync(pathname.endsWith("/") ? join(stem, "index.md") : stem + ".md");
          const within = relative(root, source);
          if (isAbsolute(within) || within === ".." || within.startsWith(".." + sep)) throw new Error("The document is outside the preview root.");
          const text = readFileSync(source, "utf8");
          const where = [body.table, body.row, body.col];
          if (!where.every(Number.isInteger)) throw new Error("Invalid cell.");
          if (body.value === undefined) return reply(response, 200, readCell(text, ...where));
          writeFileSync(source, writeCell(text, ...where, body.value, body.hash));
          return reply(response, 200, { saved: true });
        } catch (error) {
          return reply(response, 400, { error: error.message });
        }
      }
      if (request.url === "/attachments") {
        try {
          return reply(response, 200, { id: saveImage(Buffer.concat(chunks)) });
        } catch (error) {
          return reply(response, 400, { error: error.message });
        }
      }
      if (["/settings", "/agent-update", "/agent-add", "/agent-status", "/agent-vote", "/agent-waiting", "/face-open", "/face-post"].includes(request.url)) {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (request.url.startsWith("/face-")) {
            if (!mesh?.faces) throw new Error("No mesh available.");
            const faces = await mesh.faces();
            const result = request.url === "/face-open" ? faces.open({ members: body.members, topic: body.topic }) : faces.post(body.id, body.content, "high");
            if (result.error) throw new Error(result.error);
            revision++;
            return reply(response, 200, result);
          }
          if (request.url === "/agent-update") return reply(response, 200, agentUpdate(body));
          if (request.url === "/agent-add") return reply(response, 200, api.add(body));
          if (request.url === "/agent-status") return reply(response, 200, api.setStatus(body));
          if (request.url === "/agent-waiting") return reply(response, 200, api.waiting(body));
          if (request.url === "/agent-vote") return reply(response, 200, await api.vote(body));
          const next = { ...settings };
          if (body.owner !== undefined) {
            if (typeof body.owner !== "string" || !NAME.test(body.owner)) throw new Error("Owner must be a short name.");
            next.owner = body.owner;
          }
          if (body.team !== undefined) next.team = names(body.team, "team");
          if (body.last !== undefined) next.last = names(body.last, "last");
          if (body.default !== undefined) {
            if (!["owner", "last"].includes(body.default)) throw new Error("Default must be owner or last.");
            next.default = body.default;
          }
          if (body.tts !== undefined) next.tts = body.tts === true;
          if (body.autopilot !== undefined) {
            const ap = body.autopilot;
            if (!ap) delete next.autopilot;
            else {
              const hours = Number(ap.hours);
              if (!(hours > 0 && hours <= 48)) throw new Error("Autopilot hours must be between 0 and 48.");
              if (ap.brief !== undefined && (typeof ap.brief !== "string" || ap.brief.length > 400)) throw new Error("Autopilot brief must be at most 400 characters.");
              next.autopilot = { until: new Date(Date.now() + hours * 3_600_000).toISOString(), ...(ap.brief ? { brief: ap.brief.trim() } : {}) };
            }
          }
          settings = next;
          writeFileSync(settingsFile, JSON.stringify(settings), { mode: 0o600 });
          revision++;
          return reply(response, 200, effective());
        } catch (error) {
          return reply(response, 400, { error: error.message });
        }
      }
      if (request.url === "/userseen") {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          const entries = Object.entries(body.seen || {}).slice(0, 200).map(([id, key]) => [identifier(id, "Comment ID"), field(key, "Reply ID", 36)]);
          if (entries.length || !seenInit) {
            const record = { event: "userseen", seen: Object.fromEntries(entries), at: new Date().toISOString() };
            append(log, record);
            apply(record);
          }
          return reply(response, 200, { saved: true, seenInit });
        } catch (error) {
          return reply(response, 400, { error: error.message });
        }
      }
      let input;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        input = request.url === "/updates" ? normalizeUpdate(body, "user") : normalize(body);
      } catch (error) {
        return reply(response, error instanceof CommentConflict ? 409 : 400, { error: error.message });
      }
      if (request.url === "/updates") {
        const result = saveUpdate(input);
        saved = true;
        if (input.reply !== undefined && !input.note) announce(comments.get(input.commentId), input.reply, input.queued, input.whisper === true ? input.to : undefined);
        if (!input.queued) await notify();
        return reply(response, 200, { ...result, awaitingReview: !comments.get(input.commentId).seen });
      }
      let comment = comments.get(input.id);
      if (comment) {
        if (JSON.stringify(comment.input) !== JSON.stringify(input)) {
          return reply(response, 409, { error: "This comment ID already has different content." });
        }
      } else {
        comment = {
          ...input, input, event: "comment", at: new Date().toISOString(), seen: false,
          sourceHash: createHash("sha256").update(readFileSync(input.source)).digest("hex"),
        };
        append(log, comment);
        apply(comment);
        comment = comments.get(comment.id);
      }
      saved = true;
      if (!comment.note && !comment.highlight) announce(comment, comment.comment, input.queued);
      if (!input.queued) await notify();
      reply(response, 200, { id: comment.id, saved: true, awaitingReview: !comment.seen });
    } catch (error) {
      await onError(error);
      reply(response, 503, { saved, error: error.message });
    }
  });
  await new Promise((accept, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", accept);
  });
  writeFileSync(connectionFile, JSON.stringify({
    port: server.address().port, token, sessionId, previewOrigin, ...(name ? { name } : {}), standalone: Boolean(onRestart), pid: process.pid, documentRoot, startedAt: new Date().toISOString(),
  }), { mode: 0o600 });
  return (api = {
    connectionFile,
    list: () => [...comments.values()].map(withFiles),
    // Agent-authored thread: quiet (the agent already knows), red by default, shown in the browser.
    add: input => {
      const value = normalize({
        ...input, sessionId, id: randomUUID(), color: input.color || "red", section: input.section || input.page,
        url: new URL(field(input.page, "Page", 2048), previewOrigin).href,
      });
      const proposal = input.proposal && typeof input.proposal === "object"
        ? { before: String(input.proposal.before ?? "").slice(0, 8000), after: String(input.proposal.after ?? "").slice(0, 8000) } : undefined;
      const refs = Array.isArray(input.refs) ? [...new Set(input.refs.filter(id => comments.has(id)))].slice(0, 20) : [];
      let from = typeof input.from === "string" && /^[\w .@-]{1,60}$/.test(input.from.trim()) ? input.from.trim() : undefined;
      if (!from && typeof input.fromSession === "string") {
        const row = rowForSession(input.fromSession);
        if (row?.slug) from = String(row.slug).slice(0, 60);
      }
      const record = {
        ...value, ...(from ? { from } : {}), ...(proposal ? { proposal } : {}), ...(refs.length ? { refs } : {}), input: value, event: "comment", author: "copilot", at: new Date().toISOString(), seen: true,
        sourceHash: createHash("sha256").update(readFileSync(value.source)).digest("hex"),
      };
      append(log, record);
      apply(record);
      if (record.to?.length) announce(comments.get(record.id), record.comment, false, record.to, from);
      return { id: record.id, saved: true, url: record.url };
    },
    vote: input => voteAction(input, input.from ? canon(slugify(input.from)) : input.fromSession ? nameFor(input.fromSession) : ownerName()),
    waiting: ({ what = "", minutes = 60, pid, run, thread, from, fromSession }) => {
      const slug = from ? canon(slugify(from)) : fromSession ? nameFor(fromSession) : ownerName();
      const text = String(what).trim().slice(0, 120);
      if (!text) { waits.delete(slug); return { saved: true, cleared: slug }; }
      const process = Number.isInteger(pid) && pid > 1 ? pid : undefined;
      const runId = typeof run === "string" && /^[\w.-]+\/[\w.-]+$/.test(run) ? run : undefined;
      const threadId = typeof thread === "string" ? [...comments.keys()].find(id => id === thread || id.startsWith(thread)) : undefined;
      if (run && !runId) throw new Error("run must be <experiment>/<run>.");
      if (thread && !threadId) throw new Error("No such thread.");
      // A wait that names a process, run or thread ends with it (capped at a day); a time-only wait is capped at 30 minutes, so it cannot quietly mute the queue.
      const named = process || runId || threadId;
      const until = Date.now() + Math.min(Math.max(Number(minutes) || 60, 1), named ? 1440 : 30) * 60_000;
      waits.set(slug, { what: text, until, pid: process, run: runId, thread: threadId, since: Date.now() });
      return { saved: true, agent: slug, what: text, until: new Date(until).toISOString(), ...(process ? { pid: process } : {}), ...(runId ? { run: runId } : {}), ...(threadId ? { thread: threadId } : {}) };
    },
    setStatus: ({ state = "working", text = "" }) => {
      if (state === "blocked" && !String(text).trim()) throw new Error("state 'blocked' needs a reason in text (up to 120 characters).");
      agentStatus = { state: String(state).slice(0, 24), text: String(text).slice(0, 120), at: new Date().toISOString() };
      return { saved: true };
    },
    update: (input, author = "copilot") => author === "copilot" ? agentUpdate(input) : saveUpdate(normalizeUpdate(input, author)),
    pending: (as) => {
      const rows = unread(as);
      return { count: rows.length, latestId: rows.length ? latestFeedbackId : undefined };
    },
    read: ({ includeSeen = false, as = ownerName() } = {}) => readAs(as, includeSeen),
    unanswered: ({ as = ownerName() } = {}) => unansweredFor(as),
    close: async () => {
      clearInterval(nudgeTimer);
      clearInterval(eventsTimer);
      clearInterval(unblockTimer);
      clearInterval(voteTimer);
      unlinkSync(connectionFile);
      await new Promise((accept, reject) => server.close(error => error ? reject(error) : accept()));
    },
  });
}
