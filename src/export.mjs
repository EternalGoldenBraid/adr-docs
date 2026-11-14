import { build as esbuild } from "esbuild";
import { build } from "vitepress";
import { execFileSync } from "node:child_process";
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync,
  symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".wav": "audio/wav",
  ".woff2": "font/woff2", ".json": "application/json",
};
const scriptSafe = text => text.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
const isLocal = url => url && !/^([a-z][a-z\d+.-]*:|\/\/|#)/i.test(url);

// "/a/b" -> dist/a/b.html and hash-map key "a_b.md"; "/a/" -> dist/a/index.html and "a_index.md".
function pageFiles(page) {
  const clean = decodeURIComponent(page.split(/[?#]/)[0]);
  if (clean === "/" || clean === "") return { html: "index.html", key: "index.md" };
  const trimmed = clean.replace(/^\/|\.html$/g, "");
  if (trimmed.endsWith("/")) return { html: `${trimmed}index.html`, key: `${trimmed.replace(/\/$/, "").replaceAll("/", "_")}_index.md` };
  return { html: `${trimmed}.html`, key: `${trimmed.replaceAll("/", "_")}.md` };
}

async function buildSite(documentRoot, onlyPage) {
  const workspace = mkdtempSync(join(tmpdir(), "adr-export-"));
  mkdirSync(join(workspace, ".vitepress", "theme"), { recursive: true });
  symlinkSync(documentRoot, join(workspace, "source"), "junction");
  symlinkSync(join(packageRoot, "node_modules"), join(workspace, "node_modules"), "junction");
  writeFileSync(join(workspace, ".vitepress", "theme", "index.mjs"),
    `export { default } from ${JSON.stringify(join(packageRoot, "src/theme/index.mjs"))};\n`);
  writeFileSync(join(workspace, ".vitepress", "config.mjs"),
    `import { previewConfig } from ${JSON.stringify(pathToFileURL(join(packageRoot, "src/vitepress-config.mjs")).href)};\n` +
    `export default previewConfig(${JSON.stringify({ documentRoot, connectionFile: "", workspace, packageRoot, exportMode: true, onlyPage })});\n`);
  await build(workspace);
  return workspace;
}

async function bundleScript(dist, key) {
  const assets = join(dist, "assets");
  const hash = JSON.parse(readFileSync(join(dist, "hashmap.json"), "utf8"));
  if (!hash[key]) throw new Error(`No built page for ${key}.`);
  const pageChunk = `${key}.${hash[key]}.js`;
  const app = readdirSync(assets).find(name => /^app\..+\.js$/.test(name));
  // The first navigation imports the page chunk dynamically, which file:// forbids; hand over the bundled module instead.
  const result = await esbuild({
    stdin: {
      contents: `import * as page from "./${pageChunk}"; window.__adrPage = page; import "./${app}";`,
      resolveDir: assets, loader: "js",
    },
    bundle: true, format: "iife", minify: true, write: false, target: "es2020",
    define: { "import.meta.env": "{}", "import.meta.url": '""' },
    plugins: [{
      name: "adr-page-import",
      setup(b) {
        b.onLoad({ filter: /app\.[^/]+\.js$/ }, args => {
          const source = readFileSync(args.path, "utf8");
          if (!source.includes("import(t)")) throw new Error("Unsupported VitePress client; cannot export.");
          return { contents: source.replace("import(t)", "Promise.resolve(window.__adrPage)"), loader: "js" };
        });
      },
    }],
    logLevel: "silent",
  });
  return { code: result.outputFiles[0].text, pageSource: readFileSync(join(assets, pageChunk), "utf8") };
}


function inlineStyles(html, dist) {
  return html.replace(/<link rel="(?:preload )?stylesheet" href="([^"]+\.css)"[^>]*>/g, (_, href) => {
    const file = join(dist, href);
    const base = dirname(file);
    let css = readFileSync(file, "utf8");
    // Latin faces only: the other Inter subsets add about 300 KB and are used only for other scripts.
    css = css.replace(/@font-face\{[^}]*\}/g, face => /latin(?!-ext)\.[^.]+\.woff2/.test(face) && !/cyrillic|greek|vietnamese/.test(face) ? face : "");
    css = css.replace(/url\(([^)]+)\)/g, (match, raw) => {
      const url = raw.replace(/^["']|["']$/g, "");
      if (!isLocal(url)) return match;
      const path = join(base, url.split(/[?#]/)[0]);
      return existsSync(path) ? `url(data:${MIME[extname(path)] ?? "application/octet-stream"};base64,${readFileSync(path).toString("base64")})` : match;
    });
    return `<style>${css}</style>`;
  });
}

export async function exportPage({ documentPath, documentRoot, page, outFile, inlineLimit = 2 * 1024 * 1024, zip } = {}) {
  let stem = "index";
  if (documentPath) {
    const document = realpathSync(documentPath);
    if (extname(document) !== ".md") throw new Error("Export needs a Markdown (.md) document.");
    documentRoot = dirname(document);
    stem = basename(document, ".md");
  }
  if (!documentRoot) throw new Error("Export needs a document or a document root.");
  page ??= stem === "index" ? "/" : `/${stem}`;
  const warnings = [];
  const slug = decodeURIComponent(page.split(/[?#]/)[0]).replace(/^\/|\.html$/g, "").replace(/\/$/, "");
  const sourceOf = root => [`${slug}.md`, `${slug ? `${slug}/` : ""}index.md`].find(file => (slug !== "" || file === "index.md") && existsSync(join(root, file)));
  // The document may be the page itself (or any file in the site): climb to the directory the page path is relative to.
  if (documentPath) {
    for (let root = documentRoot; ; root = dirname(root)) {
      if (sourceOf(root)) { documentRoot = root; break; }
      if (dirname(root) === root) break;
    }
  }
  const onlyPage = sourceOf(documentRoot);
  if (!onlyPage) throw new Error(`Page ${page} not found under ${documentRoot}. Pass any .md file in the site root, e.g. its index.md, or the page's own file.`);
  const workspace = await buildSite(documentRoot, onlyPage);
  try {
    const dist = join(workspace, "dist");
    const { html: htmlName, key } = pageFiles(page);
    const htmlPath = join(dist, htmlName);
    if (!existsSync(htmlPath)) throw new Error(`Page not found: ${page}`);
    const pageDir = dirname(htmlPath);
    let html = readFileSync(htmlPath, "utf8");
    const { code, pageSource } = await bundleScript(dist, key);

    html = html
      .replace(/<link rel="(?:modulepreload|preload)"[^>]*(?:\.js|\.woff2)"[^>]*>/g, "")
      .replace(/<script type="module"[^>]*><\/script>/g, "");
    html = inlineStyles(html, dist);

    const files = { "hashmap.json": readFileSync(join(dist, "hashmap.json"), "utf8") };
    for (const match of pageSource.matchAll(/["'`]([^"'`\s]+\.json)["'`]/g)) {
      const url = match[1];
      if (!isLocal(url) && !url.startsWith("/")) continue;
      const path = url.startsWith("/") ? join(dist, url) : join(pageDir, url);
      if (existsSync(path)) files[url.replace(/^\.?\//, "")] = readFileSync(path, "utf8");
      else warnings.push(`Data file not found: ${url}`);
    }

    const media = [];
    html = html.replace(/\b(src|poster)="([^"]+)"/g, (whole, attribute, url) => {
      if (!isLocal(url)) return whole;
      const path = url.startsWith("/") ? join(dist, url.split(/[?#]/)[0]) : join(pageDir, url.split(/[?#]/)[0]);
      if (!existsSync(path) || !statSync(path).isFile()) { warnings.push(`Missing file: ${url}`); return whole; }
      if (statSync(path).size <= inlineLimit) {
        return `${attribute}="data:${MIME[extname(path)] ?? "application/octet-stream"};base64,${readFileSync(path).toString("base64")}"`;
      }
      const name = `media/${media.length}-${basename(path)}`;
      media.push({ path, name });
      return `${attribute}="${name}"`;
    });

    html = html.replace(/<iframe\b[^>]*\bsrc="([^"]*)"[^>]*>(?:<\/iframe>)?/g, (whole, src) => {
      if (!/^(https?:)?\/\/(localhost|127\.|\[::1\])/i.test(src) && !isLocal(src)) return whole;
      warnings.push(`Interactive embed not available offline: ${src}`);
      return `<div style="padding:16px;border:1px dashed #888;border-radius:8px;color:#aaa">Interactive viewer not available in the offline copy.<br><small>${src.replace(/[<>&"]/g, "")}</small></div>`;
    });

    const shim = "for(const m of['replaceState','pushState']){const o=history[m].bind(history);history[m]=(...a)=>{try{o(...a)}catch{}}}" +
      `window.__ADR_FILES=${scriptSafe(JSON.stringify(files))};` +
      "const f=window.fetch;window.fetch=(u,o)=>{const p=String(u&&u.url||u).split(/[?#]/)[0].replace(/^[a-z]+:\\/\\/[^/]*/i,'').replace(/^\\.?\\//,'');" +
      "const k=Object.keys(window.__ADR_FILES).find(x=>x===p||p.endsWith('/'+x));" +
      "return k?Promise.resolve(new Response(window.__ADR_FILES[k],{headers:{'Content-Type':'application/json'}})):f(u,o)};" +
      "addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href]');if(!a)return;const h=a.getAttribute('href');" +
      "if(h&&!h.startsWith('#')&&!/^[a-z][a-z\\d+.-]*:/i.test(h)){e.preventDefault();e.stopImmediatePropagation()}},true);";
    // The route is the file's own path under file://, so any route must resolve to this page.
    html = html.replace(/<script>window\.__VP_HASH_MAP__=[\s\S]*?<\/script>/, whole =>
      `${whole}<script>(()=>{const v=window.__VP_HASH_MAP__[${JSON.stringify(key)}];window.__VP_HASH_MAP__=new Proxy({},{get:()=>v})})()</script>`);
    html = html.replace("</head>", () => `<script>(()=>{${shim}})()</script></head>`)
      .replace("</body>", () => `<script>${scriptSafe(code)}</script></body>`);

    const asZip = zip ?? media.length > 0;
    const target = resolve(outFile ?? `${basename(htmlName, ".html") === "index" ? stem : basename(htmlName, ".html")}.${asZip ? "zip" : "html"}`);
    if (asZip) {
      const staging = join(workspace, "bundle");
      mkdirSync(join(staging, "media"), { recursive: true });
      writeFileSync(join(staging, "index.html"), html);
      for (const item of media) copyFileSync(item.path, join(staging, item.name));
      rmSync(target, { force: true });
      execFileSync("zip", ["-qr", target, "."], { cwd: staging });
    } else {
      writeFileSync(target, html);
    }
    return { file: target, kind: asZip ? "zip" : "html", warnings, bytes: statSync(target).size };
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}
