import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readPageTree } from "./page-tree.mjs";

const LIMIT = 200;

// Pages reachable from `from` (a site link): itself, `down` levels of descendants, `up` ancestors.
// down/up undefined means unlimited descendants and no ancestors; -1 means all levels; with no `from` every page is searched.
export function scopePages(pages, from, { down, up } = {}) {
  if (down < 0) down = Infinity;
  if (up < 0) up = Infinity;
  const here = from === undefined ? undefined : pages.find(page => page.link === from);
  if (!here) return pages;
  const keep = new Map([[here.slug, here]]);
  let layer = [here];
  for (let depth = 0; depth < (down ?? Infinity) && layer.length; depth++) {
    layer = pages.filter(page => layer.some(parent => parent.slug === page.parent) && !keep.has(page.slug));
    for (const page of layer) keep.set(page.slug, page);
  }
  let ancestor = here;
  for (let level = 0; level < (up ?? 0); level++) {
    ancestor = pages.find(page => page.slug === ancestor.parent);
    if (!ancestor) break;
    keep.set(ancestor.slug, ancestor);
  }
  return pages.filter(page => keep.has(page.slug));
}

// Smart-case regex search over page Markdown, like ripgrep: case-insensitive unless the pattern has an
// uppercase letter or `caseSensitive` is set. Returns {hits, pages, links (the searched pages), truncated}; throws on a bad regex.
export function searchPages(documentRoot, { pattern, from, down, up, caseSensitive = false }) {
  if (!pattern) throw new Error("Empty pattern.");
  const regex = new RegExp(pattern, caseSensitive || /[A-Z]/.test(pattern) ? "" : "i");
  const pages = scopePages(readPageTree(documentRoot, { publishedOnly: true, grouped: false }), from, { down, up });
  const hits = [];
  for (const page of pages) {
    const lines = readFileSync(join(documentRoot, page.slug + ".md"), "utf8").split("\n");
    for (let index = 0; index < lines.length; index++) {
      const match = regex.exec(lines[index]);
      if (!match) continue;
      if (hits.length === LIMIT) return { hits, pages: pages.length, links: pages.map(page => page.link), truncated: true };
      hits.push({ link: page.link, title: page.title, line: index + 1, text: lines[index].trim().slice(0, 200), match: match[0] });
    }
  }
  return { hits, pages: pages.length, links: pages.map(page => page.link), truncated: false };
}
