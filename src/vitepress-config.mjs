import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import mathjax from "markdown-it-mathjax3";
import { previewComments } from "../scripts/preview_comments/vite-plugin.mjs";

// Extension stdout carries JSON-RPC; renderer logs must use stderr.
function stderrLogger() {
  const warnings = new Set();
  const errors = new WeakSet();
  const logger = {
    hasWarned: false,
    info: message => console.error(message),
    warn(message) { logger.hasWarned = true; console.error(message); },
    warnOnce(message) {
      if (!warnings.has(message)) { warnings.add(message); logger.warn(message); }
    },
    error(message, options) {
      if (options?.error) errors.add(options.error);
      console.error(message);
    },
    clearScreen() {},
    hasErrorLogged: error => errors.has(error),
  };
  return logger;
}

// Top bar: one link per top-level Markdown file. Label: `nav:` front matter, else first heading.
function navLinks(documentRoot) {
  return readdirSync(documentRoot).filter(f => f.endsWith(".md")).sort().map(file => {
    const stem = basename(file, ".md");
    const text = readFileSync(join(documentRoot, file), "utf8");
    const label = text.match(/^---\n[\s\S]*?^nav:\s*(.+)$/m)?.[1]
      ?? text.match(/^# (.+)$/m)?.[1] ?? stem;
    return { text: label.trim(), link: stem === "index" ? "/" : "/" + encodeURIComponent(stem) };
  }).sort((a, b) => (a.link === "/" ? -1 : b.link === "/" ? 1 : 0));
}

export function previewConfig({ documentRoot, connectionFile, workspace, packageRoot }) {
  return {
    srcDir: `${workspace}/source`,
    cacheDir: `${workspace}/cache`,
    outDir: `${workspace}/dist`,
    title: "Agent Doc Review",
    head: [
      ["link", { rel: "icon", href: "data:," }],
      ["style", {}, '.vp-doc mjx-container[display="true"] { overflow-y: hidden; }'],
    ],
    appearance: "force-dark",
    markdown: { config: md => md.use(mathjax, { tex: { tags: "ams" } }) },
    vue: { template: { compilerOptions: { isCustomElement: tag => tag.startsWith("mjx-") } } },
    themeConfig: { outline: "deep", nav: navLinks(documentRoot) },
    vite: {
      resolve: { preserveSymlinks: true },
      // VitePress supplies fixed optimizer inputs; the document tree needs no dependency scan.
      optimizeDeps: { noDiscovery: true, include: ["cytoscape"] },
      customLogger: stderrLogger(),
      plugins: [previewComments({ connectionFile })],
      server: {
        host: "127.0.0.1",
        fs: { allow: [documentRoot, packageRoot, workspace] },
      },
    },
  };
}
