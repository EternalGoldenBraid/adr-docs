import { readdirSync, readFileSync, utimesSync } from "node:fs";
import { basename, join, relative } from "node:path";

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

// Pages are the top-level Markdown files. Front matter: `nav:` label, `parent:` page slug
// (default: top level), `order:` number. Top-bar links are the pages without a parent.
export function readPageTree(documentRoot, { publishedOnly = false } = {}) {
  const files = readdirSync(documentRoot).filter(f => f.endsWith(".md"))
    .filter(f => !publishedOnly || !isUnpublished(readFileSync(join(documentRoot, f), "utf8")));
  const pages = files.map(file => {
    const slug = basename(file, ".md");
    const text = readFileSync(join(documentRoot, file), "utf8");
    const front = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    const key = name => front.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1].trim().replace(/^["']|["']$/g, "");
    const order = Number(key("order"));
    return {
      slug, link: slug === "index" ? "/" : "/" + encodeURIComponent(slug),
      title: key("nav") ?? text.match(/^# (.+)$/m)?.[1].trim() ?? key("title") ?? slug,
      parent: key("parent") || null,
      order: Number.isFinite(order) ? order : 1000,
    };
  });
  const slugs = new Set(pages.map(page => page.slug));
  for (const page of pages) if (page.parent === page.slug || !slugs.has(page.parent)) page.parent = null;
  const rank = (a, b) => (a.slug === "index" ? -1 : b.slug === "index" ? 1 : 0) ||
    a.order - b.order || a.title.localeCompare(b.title);
  return pages.sort(rank);
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

export function treeThemeConfig(documentRoot, options) {
  const pages = readPageTree(documentRoot, options);
  return { nav: topBar(pages), pageTree: pages };
}
