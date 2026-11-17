import { existsSync, readdirSync, readFileSync, utimesSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { readBoard } from "./workstreams.mjs";

const frontOf = text => text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
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
      status: key("status")?.toLowerCase(), groupBy: key("group-by")?.toLowerCase(),
    };
  });
  for (const page of pages) if (page.parent === page.slug || !slugs.has(page.parent)) page.parent = null;
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

export function treeThemeConfig(documentRoot, options) {
  const pages = readPageTree(documentRoot, options);
  // The static build gets VitePress's built-in fuzzy search. The live preview keeps `/` for its own :grep.
  const search = options?.publishedOnly && process.argv.includes("build")
    ? { search: { provider: "local", options: { miniSearch: { searchOptions: { fuzzy: 0.2, prefix: true } } } } } : {};
  return { nav: topBar(pages), pageTree: pages, workstreams: workstreamSummary(documentRoot), classification: classificationConfig(documentRoot), ...search };
}
