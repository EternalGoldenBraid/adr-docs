import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readPageTree } from "./page-tree.mjs";

const worker = join(dirname(fileURLToPath(import.meta.url)), "..", "tools", "embed.py");
const cacheFile = join(homedir(), ".local", "state", "agent-doc-review", "embeddings.json");
const BATCH = 32, MAX_CHUNK = 600, TOP = 15;

const cache = new Map();
try { for (const [key, vector] of Object.entries(JSON.parse(readFileSync(cacheFile, "utf8")))) cache.set(key, vector); } catch { /* no cache yet */ }
let saveTimer;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    mkdirSync(dirname(cacheFile), { recursive: true });
    writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(cache)));
  }, 2000).unref();
}

// One long-lived local worker (CPU, small model); it exits after a quiet period and restarts on demand.
let child, lines = "", waiting = new Map(), nextId = 1, idle;
function start() {
  if (child) return child;
  child = spawn("uv", ["run", "--quiet", "--with", "fastembed", "python", worker], { stdio: ["pipe", "pipe", "inherit"] });
  child.stdout.on("data", chunk => {
    lines += chunk;
    let at;
    while ((at = lines.indexOf("\n")) >= 0) {
      const message = JSON.parse(lines.slice(0, at));
      lines = lines.slice(at + 1);
      if (message.ready) waiting.get("ready")?.(); else waiting.get(message.id)?.(message.vectors);
    }
  });
  const gone = () => { child = undefined; for (const reject of waiting.values()) reject(new Error("The embedding worker stopped.")); waiting = new Map(); };
  child.on("exit", gone);
  child.on("error", gone);
  return child;
}
const ready = () => new Promise(resolve => { if (child && child.ready) return resolve(); start(); waiting.set("ready", () => { child.ready = true; resolve(); }); });
async function embedRaw(texts) {
  await ready();
  clearTimeout(idle);
  idle = setTimeout(() => child?.kill(), 10 * 60 * 1000);
  idle.unref();
  const id = nextId++;
  return new Promise((resolve, reject) => { waiting.set(id, resolve); child.stdin.write(JSON.stringify({ id, texts }) + "\n"); }).finally(() => waiting.delete(id));
}

const keyOf = text => createHash("sha256").update(text).digest("hex");
export async function embed(texts) {
  const missing = [...new Set(texts.filter(text => !cache.has(keyOf(text))))];
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    const vectors = await embedRaw(batch);
    batch.forEach((text, n) => cache.set(keyOf(text), vectors[n].map(v => Math.round(v * 1e5) / 1e5)));
  }
  if (missing.length) saveSoon();
  return texts.map(text => cache.get(keyOf(text)));
}

const dot = (a, b) => { let sum = 0; for (let i = 0; i < a.length; i++) sum += a[i] * b[i]; return sum; };

// Paragraph-sized pieces of a page, each carrying the nearest heading so a hit says where it is.
export function chunkPage(markdown) {
  const body = markdown.replace(/^---\n[\s\S]*?\n---\n/, "");
  const chunks = [];
  let heading = "", buffer = [], startLine = 1, line = 1;
  const flush = () => {
    const text = buffer.join(" ").replace(/\s+/g, " ").trim();
    if (text.length > 40) chunks.push({ heading, line: startLine, text: text.slice(0, MAX_CHUNK) });
    buffer = [];
  };
  for (const row of body.split("\n")) {
    line++;
    const title = row.match(/^#{1,6}\s+(.*)/);
    if (title) { flush(); heading = title[1].trim(); startLine = line; continue; }
    if (!row.trim()) { flush(); startLine = line + 1; continue; }
    if (buffer.join(" ").length + row.length > MAX_CHUNK) { flush(); startLine = line; }
    buffer.push(row.trim());
  }
  flush();
  return chunks;
}

// Rank page chunks and the given comment threads ({id, url, text}) by meaning; returns the top matches.
export async function semanticSearch(documentRoot, { query, threads = [] }) {
  if (!query?.trim()) throw new Error("Empty query.");
  const items = [];
  for (const page of readPageTree(documentRoot, { publishedOnly: true, grouped: false })) {
    const file = join(documentRoot, page.slug + ".md");
    if (!existsSync(file)) continue;
    for (const chunk of chunkPage(readFileSync(file, "utf8"))) items.push({ kind: "page", link: page.link, title: page.title, ...chunk });
  }
  for (const thread of threads.slice(0, 2000)) items.push({ kind: "thread", id: thread.id, link: thread.url, title: thread.title ?? "", text: String(thread.text).slice(0, MAX_CHUNK) });
  const [queryVector] = await embed([`Represent this sentence for searching relevant passages: ${query.trim()}`]);
  const vectors = await embed(items.map(item => item.text));
  const scored = items.map((item, i) => ({ ...item, score: dot(queryVector, vectors[i]) })).sort((a, b) => b.score - a.score).slice(0, TOP);
  return { hits: scored.map(hit => ({ ...hit, score: Number(hit.score.toFixed(3)) })), searched: items.length };
}
