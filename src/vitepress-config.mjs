import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import mathjax from "markdown-it-mathjax3";
import taskLists from "./task-lists.mjs";
import editableTables from "./editable-tables.mjs";
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

// GET /__adr/version -> {running, onDisk}: onDisk differs once the plugin was updated under a running preview.
function versionPlugin(packageRoot) {
  const read = () => { try { return JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version; } catch { return undefined; } };
  const running = read();
  return {
    name: "adr-version",
    configureServer(server) {
      server.middlewares.use("/__adr/version", (request, response) => {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ running, onDisk: read() }));
      });
    },
  };
}

// GET /__adr/search?q=<regex>&from=/page&down=N&up=N&case=1 -> {hits:[{link,title,line,text,match}], pages, truncated}.
function searchPlugin(documentRoot) {
  return {
    name: "adr-search",
    configureServer(server) {
      server.middlewares.use("/__adr/semantic", async (request, response) => {
        let raw = "";
        for await (const chunk of request) { raw += chunk; if (raw.length > 4_000_000) break; }
        let code = 200, body;
        try {
          const { semanticSearch } = await import("./semantic.mjs");
          const input = JSON.parse(raw || "{}");
          body = await semanticSearch(documentRoot, { query: input.query, threads: Array.isArray(input.threads) ? input.threads : [] });
        } catch (error) { code = 400; body = { error: error.message }; }
        response.writeHead(code, { "Content-Type": "application/json" });
        response.end(JSON.stringify(body));
      });
      server.middlewares.use("/__adr/search", async (request, response) => {
        const q = new URL(request.url, "http://x").searchParams;
        const count = name => (q.has(name) ? Number(q.get(name)) : undefined);
        const { searchPages } = await import("./search.mjs");
        let code = 200, body;
        try {
          body = searchPages(documentRoot, { pattern: q.get("q"), from: q.get("from") ?? undefined, down: count("down"), up: count("up"), caseSensitive: q.get("case") === "1" });
        } catch (error) { code = 400; body = { error: error.message }; }
        response.writeHead(code, { "Content-Type": "application/json" });
        response.end(JSON.stringify(body));
      });
    },
  };
}

// Export jobs: GET /__adr/export/start?page=/a&page=/b[&single=1][&compress=1] -> {id}; /status?id -> progress; /file?id -> the download.
// GET /__adr/export?page=/x still returns one page directly. All work with or without an agent session.
function exportPlugin(documentRoot) {
  const jobs = new Map();
  const json = (response, code, body) => { response.writeHead(code, { "Content-Type": "application/json" }); response.end(JSON.stringify(body)); };
  const param = (request, name) => new URL(request.url, "http://x").searchParams.getAll(name);
  const fileName = (pages, kind) => (pages.length > 1 ? "pages" : pages[0].replace(/^\/|\/$/g, "").replace(/\//g, "-") || "index") + "." + kind;
  const send = (response, result, pages) => {
    response.writeHead(200, {
      "Content-Type": result.kind === "zip" ? "application/zip" : "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName(pages, result.kind).replace(/[^\w.-]/g, "_")}"`,
      "X-ADR-Warnings": encodeURIComponent(result.warnings.join(" | ")).slice(0, 1000),
    });
    response.end(readFileSync(result.file));
  };
  return {
    name: "adr-export",
    configureServer(server) {
      server.middlewares.use("/__adr/export/start", async (request, response) => {
        const pages = param(request, "page");
        if (!pages.length) return json(response, 400, { error: "No pages chosen." });
        const id = randomUUID();
        const directory = mkdtempSync(join(tmpdir(), "adr-download-"));
        const job = { state: "running", stage: "Starting", done: 0, total: pages.length + 2, pages, directory };
        jobs.set(id, job);
        const { exportPage } = await import("./export.mjs");
        const compress = param(request, "compress")[0] === "1", single = compress || param(request, "single")[0] === "1";
        exportPage({ documentRoot, pages: single ? pages.slice(0, 1) : pages, single, compress, outFile: join(directory, "out.bin"), onProgress: step => Object.assign(job, step) })
          .then(result => Object.assign(job, { state: "done", result, warnings: result.warnings }))
          .catch(error => Object.assign(job, { state: "failed", error: error.message }));
        setTimeout(() => { jobs.delete(id); rmSync(directory, { recursive: true, force: true }); }, 30 * 60 * 1000).unref();
        json(response, 200, { id });
      });
      server.middlewares.use("/__adr/export/status", (request, response) => {
        const job = jobs.get(param(request, "id")[0]);
        if (!job) return json(response, 404, { error: "Unknown export." });
        json(response, 200, { state: job.state, stage: job.stage, done: job.done, total: job.total, error: job.error, warnings: job.warnings });
      });
      server.middlewares.use("/__adr/export/file", (request, response) => {
        const job = jobs.get(param(request, "id")[0]);
        if (!job?.result) return json(response, 404, { error: "Export not ready." });
        send(response, job.result, job.pages);
      });
      server.middlewares.use("/__adr/export", async (request, response) => {
        const directory = mkdtempSync(join(tmpdir(), "adr-download-"));
        try {
          const page = param(request, "page")[0] || "/";
          const { exportPage } = await import("./export.mjs");
          send(response, await exportPage({ documentRoot, page, outFile: join(directory, "page") + ".out" }), [page]);
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

// A site may add dev-server plugins in <documentRoot>/.vitepress/preview-plugins.mjs: the default export is an array of Vite plugins, or a function of documentRoot returning one. Preview only, never exports.
async function sitePlugins(documentRoot) {
  const file = join(documentRoot, ".vitepress", "preview-plugins.mjs");
  if (!existsSync(file)) return [];
  const exported = (await import(pathToFileURL(file).href)).default;
  return typeof exported === "function" ? await exported(documentRoot) : exported ?? [];
}

export function previewConfig({ documentRoot, connectionFile, workspace, packageRoot, exportMode = false, served = false, onlyPages }) {
  return {
    // An export renders chosen pages only, so unrelated pages (even with broken front matter) cannot break it.
    ...(onlyPages ? { srcExclude: markdownFiles(documentRoot).filter(file => !onlyPages.includes(file)).map(file => file.replace(/[\\*?[\]{}()!]/g, "\\$&")) } : {}),
    ...(exportMode ? { base: served ? "/" : "./", ignoreDeadLinks: true } : {}),
    srcDir: `${workspace}/source`,
    cacheDir: `${workspace}/cache`,
    outDir: `${workspace}/dist`,
    title: "Agent Doc Review",
    head: [
      ["link", { rel: "icon", href: "data:," }],
      ["style", {}, '.vp-doc mjx-container[display="true"] { overflow-y: hidden; }'],
    ],
    appearance: "force-dark",
    markdown: { config: md => md.use(mathjax, { tex: { tags: "ams" } }).use(taskLists).use(editableTables) },
    vue: { template: { compilerOptions: { isCustomElement: tag => tag.startsWith("mjx-") } } },
    themeConfig: { outline: "deep", ...treeThemeConfig(documentRoot) },
    vite: {
      resolve: { preserveSymlinks: true },
      // VitePress supplies fixed optimizer inputs; the document tree needs no dependency scan.
      optimizeDeps: { noDiscovery: true, include: ["cytoscape"] },
      customLogger: stderrLogger(),
      plugins: exportMode ? [] : [previewComments({ connectionFile }), treeJsonPlugin(documentRoot), exportPlugin(documentRoot), searchPlugin(documentRoot), versionPlugin(packageRoot), sitePlugins(documentRoot)],
      server: {
        host: "127.0.0.1",
        fs: { allow: [documentRoot, packageRoot, workspace] },
      },
    },
  };
}
