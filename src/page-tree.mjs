import { existsSync, readdirSync, readFileSync, statSync, utimesSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { readBoard } from "./workstreams.mjs";
import { publicVotes, readVotes } from "./votes.mjs";

const frontOf = text => text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
// A finished page (card-status shipped, or status done) needs a structured verdict, a front-matter block with a result (supported | not-supported | inconclusive), a claim and a confidence (hypothesis | confirmed), plus learnings: a non-empty section ("Learnings", "What we learned" or "Lessons") or the front-matter field. Free text no longer counts as a verdict.
const VERDICT_RESULTS = ["supported", "not-supported", "inconclusive"];
export function structuredVerdict(front) {
  const block = front.match(/^verdict:[ \t]*\n((?:[ \t]+\S.*\n?)+)/m)?.[1];
  if (!block) return false;
  const field = name => block.match(new RegExp(`^[ \\t]+${name}:[ \\t]*["']?([^"'\\n]+?)["']?[ \\t]*$`, "m"))?.[1];
  return VERDICT_RESULTS.includes(field("result")) && Boolean(field("claim")) && ["hypothesis", "confirmed"].includes(field("confidence"));
}
export function needsVerdict(text) {
  const front = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const done = /^card-status:\s*["']?shipped["']?\s*$/m.test(front) || /^status:\s*["']?done["']?\s*$/mi.test(front);
  if (!done) return false;
  const body = text.slice(front.length ? text.indexOf("\n---", 3) + 4 : 0);
  const fronted = name => new RegExp(`^${name}:[ \\t]*\\S`, "m").test(front);
  const filled = name => {
    const m = new RegExp(`^#{1,6}\\s*${name}\\b[^\\n]*\\n([\\s\\S]*?)(?=^#{1,6}\\s|(?![\\s\\S]))`, "mi").exec(body);
    return Boolean(m && m[1].replace(/<!--[\s\S]*?-->/g, "").trim());
  };
  return !(structuredVerdict(front) && (fronted("learnings?") || filled("(?:learnings?|what we learned|lessons)")));
}
const isUnpublished = text => /^publish:\s*false\s*$/m.test(frontOf(text));

// Markdown files (any depth) marked `publish: false`, as paths relative to the root for srcExclude.
export function unpublished(documentRoot, directory = documentRoot) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" || entry.name.startsWith(".") ? [] : unpublished(documentRoot, path);
    return entry.name.endsWith(".md") && isUnpublished(readFileSync(path, "utf8")) ? [relative(documentRoot, path)] : [];
  });
}

export function markdownFiles(root, directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".") ? [] : markdownFiles(root, path);
    return entry.name.endsWith(".md") ? [relative(root, path).split(sep).join("/")] : [];
  });
}

// Pages are the Markdown files at any depth (slug = path without `.md`). Front matter: `nav:` label,
// `parent:` page slug, `order:` number. Top-level pages default to the top bar; a page in a folder
// defaults to that folder's `index` (else the nearest ancestor's, else the root `index`).
export function readPageTree(documentRoot, { publishedOnly = false, grouped = true } = {}) {
  const files = markdownFiles(documentRoot)
    .filter(f => !publishedOnly || !isUnpublished(readFileSync(join(documentRoot, f), "utf8")));
  const slugs = new Set(files.map(f => f.slice(0, -3)));
  const folderParent = slug => {
    let directory = dirname(slug);
    for (let own = basename(slug) === "index"; directory !== "."; directory = dirname(directory)) {
      const index = `${directory}/index`;
      if (slugs.has(index) && !(own && index === slug)) return index;
      own = false;
    }
    return slugs.has("index") ? "index" : null;
  };
  const pages = files.map(file => {
    const slug = file.slice(0, -3);
    const text = readFileSync(join(documentRoot, file), "utf8");
    const front = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    const key = name => front.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1].trim().replace(/^["']|["']$/g, "");
    const order = Number(key("order"));
    const path = slug.split("/").map(encodeURIComponent).join("/");
    return {
      slug, link: slug === "index" ? "/" : slug.endsWith("/index") ? "/" + path.slice(0, -5) : "/" + path,
      title: key("nav") ?? text.match(/^# (.+)$/m)?.[1].trim() ?? key("title") ?? slug,
      parent: key("parent") || (slug.includes("/") ? folderParent(slug) : null),
      order: Number.isFinite(order) ? order : 1000,
      tense: ["past", "present", "future"].includes(key("tense")?.toLowerCase()) ? key("tense").toLowerCase() : (key("card-status") === "superseded" ? "past" : undefined),
      needsVerdict: needsVerdict(text) || undefined,
      asOf: /^\d{4}-\d{2}-\d{2}$/.test(key("as-of") ?? "") ? key("as-of") : undefined,
      status: key("status")?.toLowerCase(), groupBy: key("group-by")?.toLowerCase(),
    };
  });
  for (const page of pages) if (page.parent === page.slug || !slugs.has(page.parent)) page.parent = null;
  // A page without its own `tense:` takes the nearest ancestor's.
  const bySlug = new Map(pages.map(p => [p.slug, p]));
  for (const page of pages) {
    for (let up = page, n = 0; !page.tense && up.parent && n < 20; n++) { up = bySlug.get(up.parent); if (up?.tense) page.tense = up.tense; if (!up) break; }
  }
  const groups = [];
  for (const index of grouped ? pages.filter(p => p.groupBy === "status") : []) {
    const order = ["active", "queued", "proposed", "blocked", "done", "declined"];
    const tickets = pages.filter(p => p.parent === index.slug && p.status);
    for (const status of [...new Set(tickets.map(t => t.status))]) {
      const group = { slug: `${index.slug}#${status}`, link: `${index.link}#${status}`, title: status[0].toUpperCase() + status.slice(1),
        parent: index.slug, order: order.includes(status) ? order.indexOf(status) : order.length, virtual: true };
      groups.push(group);
      for (const t of tickets.filter(t => t.status === status)) t.parent = group.slug;
    }
  }
  pages.push(...groups);
  const rank = (a, b) => (a.slug === "index" ? -1 : b.slug === "index" ? 1 : 0) ||
    a.order - b.order || a.title.localeCompare(b.title);
  return pages.map(({ status, groupBy, ...page }) => page).sort(rank);
}

export function topBar(pages) {
  return pages.filter(page => !page.parent).map(({ title, link }) => ({ text: title, link }));
}

// Nested structure for tree.json, so an agent can read the plan's shape without opening each file.
export function nestedTree(pages, parent = null) {
  return pages.filter(page => page.parent === parent).map(({ slug, link, title, order }) =>
    ({ slug, link, title, ...(order !== 1000 ? { order } : {}), children: nestedTree(pages, slug) }));
}

// The sidebar and top bar are baked into the VitePress config; touching the config file makes
// VitePress reload it, so added, removed or re-parented pages show up without a restart.
function watchTree(server, documentRoot) {
  let known = JSON.stringify(treeThemeConfig(documentRoot));
  let timer;
  const check = file => {
    if (!file.endsWith(".md") || !file.startsWith(documentRoot)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      let now;
      try { now = JSON.stringify(treeThemeConfig(documentRoot)); } catch { return; } // root removed while closing
      if (now === known) return;
      known = now;
      const config = server.config.vitepress?.configPath ?? join(server.config.root, ".vitepress/config.mjs");
      try { utimesSync(config, new Date(), new Date()); } catch { /* no config file to touch */ }
    }, 300);
  };
  server.httpServer?.once("close", () => clearTimeout(timer));
  server.watcher.add(documentRoot);
  for (const event of ["add", "unlink", "change"]) server.watcher.on(event, check);
}

export function treeJsonPlugin(documentRoot) {
  const body = publishedOnly => JSON.stringify(nestedTree(readPageTree(documentRoot, { publishedOnly })), null, 2) + "\n";
  return {
    name: "adr-tree-json",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== "/tree.json") return next();
        response.setHeader("content-type", "application/json");
        response.end(body(false));
      });
      watchTree(server, documentRoot);
    },
    generateBundle() { this.emitFile({ type: "asset", fileName: "tree.json", source: body(true) }); },
  };
}

// Board data for the chips and <WorkstreamBoard />: id -> { status, owner, machine, priority, done, total, title, summary, date, depends_on }.
function workstreamSummary(documentRoot) {
  const directory = join(documentRoot, "workstreams");
  if (!existsSync(directory)) return {};
  return Object.fromEntries(readBoard(directory).items.map(i => [i.id, { status: i.status, owner: i.owner, machine: i.machine, priority: i.priority, done: i.steps.done, total: i.steps.total, title: i.title, summary: i.summary, date: i.date, depends_on: i.depends_on }]));
}

// Cards from front matter, so every page can be read at three levels (line, card, page):
//   card-line: one line   card-status: todo | idea | planned | building | shipped
//   card-what / card-state / card-evidence / card-next / card-owner: one short line each
export const CARD_SLOTS = ["what", "state", "evidence", "next", "owner"];
// The nested form:  card:\n  gist: "…"\n  state: planned\n  evidence/next/owner/what: "…"\n  tests:\n    - {name: "…", state: done, date: 2026-11-19}
// `gist` is the one-liner and `state` the badge; tests normalise to {name, status, at, link}; `link` is `#heading-slug` or a site path, shown on the test row.
function nestedCard(front) {
  const head = /^card:[ \t]*$/m.exec(front);
  if (!head) return {};
  const block = front.slice(head.index + head[0].length).split("\n").slice(1);
  const out = {}, tests = [];
  const unquote = v => v.trim().replace(/^["']|["']$/g, "");
  for (const line of block) {
    if (line && !/^\s/.test(line)) break;
    const item = /^\s+-\s*\{(.*)\}\s*$/.exec(line);
    if (item) {
      const f = Object.fromEntries([...item[1].matchAll(/(\w+):\s*("[^"]*"|'[^']*'|[^,}]*)/g)].map(m => [m[1], unquote(m[2])]));
      if (f.name) tests.push({ ...(f.result ? { result: f.result } : {}), ...(/^(#|\/(?!\/))[^\s]*$/.test(f.link ?? "") ? { link: f.link } : {}), ...(/^[\w.-]{1,60}$/.test(f.doer ?? "") && Number.isFinite(+f.rank) && f.rank !== "" ? { doer: f.doer, rank: +f.rank } : {}), ...(Array.isArray(f.after) ? { after: f.after.filter(x => /^[\w.-]{1,60}$/.test(x)) } : {}), name: f.name, status: (f.state ?? f.status ?? "planned").toLowerCase(), ...(/^\d{4}-\d{2}-\d{2}$/.test(f.date ?? f.at ?? "") ? { at: f.date ?? f.at } : {}) });
      continue;
    }
    const kv = /^\s+(gist|state|what|evidence|next|owner|line|status):\s*(.+)$/.exec(line);
    if (kv) out[{ gist: "line", state: "status" }[kv[1]] ?? kv[1]] = unquote(kv[2]);
  }
  if (tests.length) out.tests = tests;
  return out;
}
// A test with `result: path` is driven by a file the run script writes: {"status": "running|done|failed", "finished_at": "…"}.
// The file overrides the hand-written status and date; a missing file leaves the test as written.
function applyResults(documentRoot, tests) {
  for (const t of tests) {
    if (!t.result) continue;
    try {
      const r = JSON.parse(readFileSync(resolve(documentRoot, t.result.replace(/^\//, "")), "utf8"));
      if (["running", "done", "failed"].includes(r.status)) t.status = r.status;
      const at = String(r.finished_at ?? r.at ?? "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(at)) t.at = at;
      t.verified = true;
    } catch { /* result not written yet */ }
  }
}
// Page state from its tests: failed > running > done (none open) > planned.
export function derivedState(tests) {
  const open = tests.filter(t => t.status !== "obsolete");
  if (!open.length) return undefined;
  if (open.some(t => t.status === "failed")) return "failed";
  if (open.some(t => t.status === "running")) return "running";
  return open.every(t => t.status === "done") ? "done" : "planned";
}
const pageKey = file => "/" + file.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "").replace(/\/$/, "");
let threadsCache;
function openThreads(documentRoot) {
  try {
    const file = join(documentRoot, "threads.json");
    const stamp = statSync(file).mtimeMs;
    if (threadsCache?.file !== file || threadsCache.stamp !== stamp) {
      const counts = {}, waiting = {};
      for (const thread of JSON.parse(readFileSync(file, "utf8"))) {
        const key = String(thread.page ?? "").replace(/\.html$/, "").replace(/\/$/, "") || "/";
        counts[key] = (counts[key] ?? 0) + 1;
        waiting[key] = [...new Set([...(waiting[key] ?? []), ...(thread.unresolved_by ?? [])])];
      }
      threadsCache = { file, stamp, counts, waiting };
    }
    return threadsCache;
  } catch { return { counts: {}, waiting: {} }; }
}
export function pageCards(documentRoot, options) {
  const out = {};
  for (const file of markdownFiles(documentRoot)) {
    const text = readFileSync(join(documentRoot, file), "utf8");
    if (options?.publishedOnly && isUnpublished(text)) continue;
    const front = frontOf(text);
    const key = name => front.match(new RegExp(`^card-${name}:\\s*(.+)$`, "m"))?.[1].trim().replace(/^["']|["']$/g, "");
    const card = Object.fromEntries(["line", "status", "superseded-by", ...CARD_SLOTS].map(k => [k, key(k)]).filter(([, v]) => v));
    // One line per test: `card-test: Stage 1 | done | 2026-11-19` (status: planned, running, done, obsolete; date optional).
    const tests = [...front.matchAll(/^card-test:[ \t]*(.+)$/gm)].map(m => {
      const [name, status = "planned", at] = m[1].split("|").map(v => v.trim().replace(/^["']|["']$/g, ""));
      return { name, status: status.toLowerCase(), ...(/^\d{4}-\d{2}-\d{2}$/.test(at ?? "") ? { at } : {}) };
    });
    if (tests.length) card.tests = tests;
    Object.assign(card, Object.fromEntries(Object.entries(nestedCard(front)).filter(([k]) => !(k in card))));
    const pageOwner = front.match(/^owner:\s*(.+)$/m)?.[1].trim().replace(/^["']|["']$/g, "");
    if (pageOwner) card.owner = pageOwner;
    if (card.tests) {
      applyResults(documentRoot, card.tests);
      const derived = derivedState(card.tests);
      if (derived) { if (card.status && card.status !== derived) card.statusMismatch = card.status; card.status = derived; }
    }
    const question = front.match(/^question:[ \t]*(.+)$/m)?.[1].trim().replace(/^["']|["']$/g, "");
    if (!card.line && question && Object.keys(card).length) card.line = question;
    // Threads opened after a page is done leave it done (a past page may be discussed again); only a page's move to done is blocked while threads are open, by the status generator. `openThreads` just counts them (threads.json is written by the preview server).
    const { counts, waiting } = openThreads(documentRoot);
    const open = counts[pageKey(file)];
    if (open) card.openThreads = open;
    if (open && Object.keys(card).length && waiting[pageKey(file)]?.length) card.waitingOn = waiting[pageKey(file)];
    // Done is blocked until the structured verdict is written; the page waits in review and says what blocks it.
    if (["done", "shipped"].includes(card.status) && !structuredVerdict(front)) { card.reviewFrom ??= card.status; card.status = "review"; card.blockedBy = ["verdict"]; }
    if (/^(?:card-)?status:\s*["']?review["']?\s*$/m.test(front)) card.status = "review";
    if (Object.keys(card).length && /^status:\s*["']?todo["']?\s*$/m.test(front)) card.status = "todo";
    const missing = ["line", "owner", "status"].filter(k => !card[k]);
    if (Object.keys(card).length && missing.length) card.missing = missing.map(k => ({ line: "gist", status: "state" }[k] ?? k));
    const verdict = needsVerdict(text);
    if (!Object.keys(card).length && !verdict) continue;
    const slug = file.slice(0, -3);
    out[slug === "index" ? "/" : "/" + slug.split("/").map(encodeURIComponent).join("/")] =
      { ...card, ...(verdict ? { needsVerdict: true } : {}), title: front.match(/^nav:\s*(.+)$/m)?.[1].trim() ?? text.match(/^# (.+)$/m)?.[1].trim() ?? slug };
  }
  return out;
}

// One site-wide banner from the root index.md front matter:
//   classification: "RESTRICTED · restricted-demo org only"
//   classification-level: restricted | internal | public   (colour; inferred from the label's first word if omitted)
export function classificationConfig(documentRoot) {
  const file = join(documentRoot, "index.md");
  if (!existsSync(file)) return undefined;
  const front = readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const key = name => front.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1].trim().replace(/^["']|["']$/g, "");
  const label = key("classification");
  if (!label) return undefined;
  const level = (key("classification-level") ?? label.split(/[\s·:-]/)[0]).toLowerCase();
  return { label, level: ["restricted", "internal", "public"].includes(level) ? level : "internal" };
}

// How many days a "present" page or a running test may go without an update before it is flagged. `stale-days:` in the root index.md front matter; default 2.
function staleDays(documentRoot) {
  try {
    const n = Number(frontOf(readFileSync(join(documentRoot, "index.md"), "utf8")).match(/^stale-days:\s*(\d+(?:\.\d+)?)\s*$/m)?.[1]);
    return n > 0 ? n : 2;
  } catch { return 2; }
}
export function treeThemeConfig(documentRoot, options) {
  const pages = readPageTree(documentRoot, options);
  // The static build gets VitePress's built-in fuzzy search. The live preview keeps `/` for its own :grep.
  const search = options?.publishedOnly && process.argv.includes("build")
    ? { search: { provider: "local", options: { miniSearch: { searchOptions: { fuzzy: 0.2, prefix: true } } } } } : {};
  return { staleDays: staleDays(documentRoot), nav: topBar(pages), pageTree: pages, workstreams: workstreamSummary(documentRoot), cards: pageCards(documentRoot, options), votes: publicVotes(readVotes(documentRoot)), classification: classificationConfig(documentRoot), ...search };
}
