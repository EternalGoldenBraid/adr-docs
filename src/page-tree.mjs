import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

// Pages are the top-level Markdown files. Front matter: `nav:` label, `parent:` page slug
// (default: top level), `order:` number. Top-bar links are the pages without a parent.
export function readPageTree(documentRoot) {
  const pages = readdirSync(documentRoot).filter(f => f.endsWith(".md")).map(file => {
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

export function treeJsonPlugin(documentRoot) {
  const body = () => JSON.stringify(nestedTree(readPageTree(documentRoot)), null, 2) + "\n";
  return {
    name: "adr-tree-json",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== "/tree.json") return next();
        response.setHeader("content-type", "application/json");
        response.end(body());
      });
    },
    generateBundle() { this.emitFile({ type: "asset", fileName: "tree.json", source: body() }); },
  };
}

export function treeThemeConfig(documentRoot) {
  const pages = readPageTree(documentRoot);
  return { nav: topBar(pages), pageTree: pages };
}
