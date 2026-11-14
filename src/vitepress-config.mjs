import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mathjax from "markdown-it-mathjax3";
import { markdownFiles, treeThemeConfig, treeJsonPlugin } from "./page-tree.mjs";
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

// GET /__adr/export?page=/x downloads an offline copy of that page; works with or without an agent session.
function exportPlugin(documentRoot) {
  return {
    name: "adr-export",
    configureServer(server) {
      server.middlewares.use("/__adr/export", async (request, response) => {
        const directory = mkdtempSync(join(tmpdir(), "adr-download-"));
        try {
          const page = new URL(request.url, "http://x").searchParams.get("page") || "/";
          const { exportPage } = await import("./export.mjs");
          const result = await exportPage({ documentRoot, page, outFile: join(directory, "page") + ".out" });
          const name = (page.replace(/^\/|\/$/g, "").replace(/\//g, "-") || "index") + "." + result.kind;
          response.writeHead(200, {
            "Content-Type": result.kind === "zip" ? "application/zip" : "text/html; charset=utf-8",
            "Content-Disposition": `attachment; filename="${name.replace(/[^\w.-]/g, "_")}"`,
            "X-ADR-Warnings": encodeURIComponent(result.warnings.join(" | ")).slice(0, 1000),
          });
          response.end(readFileSync(result.file));
        } catch (error) {
          response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
          response.end(`Export failed: ${error.message}`);
        } finally {
          rmSync(directory, { recursive: true, force: true });
        }
      });
    },
  };
}

export function previewConfig({ documentRoot, connectionFile, workspace, packageRoot, exportMode = false, onlyPage }) {
  return {
    // An export renders one page, so unrelated pages (even with broken front matter) cannot break it.
    ...(onlyPage ? { srcExclude: markdownFiles(documentRoot).filter(file => file !== onlyPage).map(file => file.replace(/[\\*?[\]{}()!]/g, "\\$&")) } : {}),
    ...(exportMode ? { base: "./", ignoreDeadLinks: true } : {}),
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
    themeConfig: { outline: "deep", ...treeThemeConfig(documentRoot) },
    vite: {
      resolve: { preserveSymlinks: true },
      // VitePress supplies fixed optimizer inputs; the document tree needs no dependency scan.
      optimizeDeps: { noDiscovery: true, include: ["cytoscape"] },
      customLogger: stderrLogger(),
      plugins: exportMode ? [] : [previewComments({ connectionFile }), treeJsonPlugin(documentRoot), exportPlugin(documentRoot)],
      server: {
        host: "127.0.0.1",
        fs: { allow: [documentRoot, packageRoot, workspace] },
      },
    },
  };
}
