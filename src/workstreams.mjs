import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

export const STATUSES = ["active", "queued", "proposed", "blocked", "done", "declined"];
const ALIASES = { "in-progress": "active", accepted: "queued" };
const SKIP = new Set(["index.md", "README.md"]);

function frontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  const data = {};
  for (const line of (match?.[1] ?? "").split(/\r?\n/)) {
    const pair = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (pair) data[pair[1]] = pair[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return { data, body: match ? text.slice(match[0].length) : text };
}

const list = value => (value ?? "").replace(/^\[|\]$/g, "").split(",").map(item => item.trim()).filter(Boolean);

// Front matter and checklist progress of every workstream file, without reading prose.
export function readBoard(directory) {
  const items = [];
  for (const file of readdirSync(directory).sort()) {
    if (!file.endsWith(".md") || SKIP.has(file)) continue;
    const { data, body } = frontMatter(readFileSync(join(directory, file), "utf8"));
    const steps = [...body.matchAll(/^\s*[-*] \[([ xX])\] (.+)$/gm)].map(m => ({ text: m[2].trim(), done: m[1] !== " " }));
    const raw = data.status || "proposed";
    const id = basename(file, ".md");
    items.push({
      id, file, title: data.title || id, status: ALIASES[raw] ?? raw, owner: data.owner || "", summary: data.summary || "",
      requester: data.requester || "", machine: data.machine || "", priority: data.priority === undefined || Number.isNaN(Number(data.priority)) ? null : Number(data.priority), resume: data.resume || "", date: data.date || /^\d{4}-\d{2}-\d{2}/.exec(id)?.[0] || "", depends_on: list(data.depends_on),
      steps: { done: steps.filter(s => s.done).length, total: steps.length, items: steps },
    });
  }
  const rank = status => STATUSES.includes(status) ? STATUSES.indexOf(status) : STATUSES.length;
  const byPriority = (a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity);
  items.sort((a, b) => rank(a.status) - rank(b.status) || byPriority(a, b) || a.id.localeCompare(b.id));
  const counts = Object.fromEntries(STATUSES.map(status => [status, items.filter(i => i.status === status).length]));
  return { counts, items };
}
