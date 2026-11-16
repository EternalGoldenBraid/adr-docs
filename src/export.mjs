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

async function buildSite(documentRoot, onlyPages) {
  const workspace = mkdtempSync(join(tmpdir(), "adr-export-"));
  mkdirSync(join(workspace, ".vitepress", "theme"), { recursive: true });
  symlinkSync(documentRoot, join(workspace, "source"), "junction");
  symlinkSync(join(packageRoot, "node_modules"), join(workspace, "node_modules"), "junction");
  writeFileSync(join(workspace, ".vitepress", "theme", "index.mjs"),
    `export { default } from ${JSON.stringify(join(packageRoot, "src/theme/index.mjs"))};\n`);
  writeFileSync(join(workspace, ".vitepress", "config.mjs"),
    `import { previewConfig } from ${JSON.stringify(pathToFileURL(join(packageRoot, "src/vitepress-config.mjs")).href)};\n` +
    `export default previewConfig(${JSON.stringify({ documentRoot, connectionFile: "", workspace, packageRoot, exportMode: true, onlyPages })});\n`);
  // vite build sets NODE_ENV=production process-wide, which breaks the live preview server.
  const hadEnv = Object.prototype.hasOwnProperty.call(process.env, "NODE_ENV");
  const savedEnv = process.env.NODE_ENV;
  try {
    await build(workspace);
  } finally {
    if (hadEnv) process.env.NODE_ENV = savedEnv; else delete process.env.NODE_ENV;
  }
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

const normalPage = page => decodeURIComponent(page.split(/[?#]/)[0]).replace(/\.html$/, "").replace(/(.)\/$/, "$1") || "/";
const zipName = (page, many) => (many ? pageFiles(page).html.replaceAll("/", "-") : "index.html");
const sourceFor = (root, page) => {
  const slug = decodeURIComponent(page.split(/[?#]/)[0]).replace(/^\/|\.html$/g, "").replace(/\/$/, "");
  return [`${slug}.md`, `${slug ? `${slug}/` : ""}index.md`].find(file => (slug !== "" || file === "index.md") && existsSync(join(root, file)));
};

// One built page -> standalone html plus the media files it references (copied by the caller).
async function renderPage(dist, page, inlineLimit, mediaPrefix, warnings, links = {}, documentRoot = dist, prepare = path => path) {
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
  // Graph nodes reference images and videos by site-absolute path, which does not resolve under file://.
  const assetOf = url => {
    const clean = url.split(/[?#]/)[0].replace(/^\//, "");
    return [join(dist, clean), join(documentRoot, "public", clean)].find(path => existsSync(path) && statSync(path).isFile());
  };
  const rewriteAsset = url => {
    if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) return url;
    const path = prepare(assetOf(url));
    if (!path) { warnings.push(`Missing graph file: ${url}`); return url; }
    if (statSync(path).size <= inlineLimit) return `data:${MIME[extname(path)] ?? "application/octet-stream"};base64,${readFileSync(path).toString("base64")}`;
    const name = `media/${mediaPrefix}${media.length}-${basename(path)}`;
    media.push({ path, name });
    return `./${name}`;
  };
  const rewriteGraph = value => {
    if (Array.isArray(value)) value.forEach(rewriteGraph);
    else if (value && typeof value === "object") {
      for (const key of ["image", "video"]) if (key in value) value[key] = rewriteAsset(value[key]);
      Object.values(value).forEach(rewriteGraph);
    }
  };
  for (const [name, text] of Object.entries(files)) {
    if (name === "hashmap.json") continue;
    try { const data = JSON.parse(text); rewriteGraph(data); files[name] = JSON.stringify(data); } catch (_) { /* not graph JSON */ }
  }
  html = html.replace(/\b(src|poster)="([^"]+)"/g, (whole, attribute, url) => {
    if (!isLocal(url)) return whole;
    let path = url.startsWith("/") ? join(dist, url.split(/[?#]/)[0]) : join(pageDir, url.split(/[?#]/)[0]);
    if (!existsSync(path) || !statSync(path).isFile()) { warnings.push(`Missing file: ${url}`); return whole; }
    path = prepare(path);
    if (statSync(path).size <= inlineLimit) {
      return `${attribute}="data:${MIME[extname(path)] ?? "application/octet-stream"};base64,${readFileSync(path).toString("base64")}"`;
    }
    const name = `media/${mediaPrefix}${media.length}-${basename(path)}`;
    media.push({ path, name });
    return `${attribute}="${name}"`;
  });

  html = html.replace(/<iframe\b[^>]*\bsrc="([^"]*)"[^>]*>(?:<\/iframe>)?/g, (whole, src) => {
    if (!/^(https?:)?\/\/(localhost|127\.|\[::1\])/i.test(src) && !isLocal(src)) return whole;
    warnings.push(`Interactive embed not available offline: ${src}`);
    return `<div style="padding:16px;border:1px dashed #888;border-radius:8px;color:#aaa">Interactive viewer not available in the offline copy.<br><small>${src.replace(/[<>&"]/g, "")}</small></div>`;
  });

  const shim = "for(const m of['replaceState','pushState']){const o=history[m].bind(history);history[m]=(...a)=>{try{o(...a)}catch{}}}" +
    `window.__ADR_FILES=${scriptSafe(JSON.stringify(files))};window.__ADR_PAGE=${JSON.stringify(normalPage(page))};window.__ADR_LINKS=${scriptSafe(JSON.stringify(links))};` +
    "const f=window.fetch;window.fetch=(u,o)=>{const p=String(u&&u.url||u).split(/[?#]/)[0].replace(/^[a-z]+:\\/\\/[^/]*/i,'').replace(/^\\.?\\//,'');" +
    "const k=Object.keys(window.__ADR_FILES).find(x=>x===p||p.endsWith('/'+x));" +
    "return k?Promise.resolve(new Response(window.__ADR_FILES[k],{headers:{'Content-Type':'application/json'}})):f(u,o)};" +
    "addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href]');if(!a)return;const h=a.getAttribute('href');" +
    "if(h&&!h.startsWith('#')&&!/^[a-z][a-z\\d+.-]*:/i.test(h)){e.preventDefault();e.stopImmediatePropagation();" +
    "const u=new URL(h,'http://x'+window.__ADR_PAGE);const n=decodeURIComponent(u.pathname).replace(/\\.html$/,'').replace(/(.)\\/$/,'$1');" +
    "if(window.__ADR_LINKS[n])location.href=window.__ADR_LINKS[n]+u.hash}},true);";
  // The route is the file's own path under file://, so any route must resolve to this page.
  html = html.replace(/<script>window\.__VP_HASH_MAP__=[\s\S]*?<\/script>/, whole =>
    `${whole}<script>(()=>{const v=window.__VP_HASH_MAP__[${JSON.stringify(key)}];window.__VP_HASH_MAP__=new Proxy({},{get:()=>v})})()</script>`);
  html = html.replace("</head>", () => `<script>(()=>{${shim}})()</script></head>`)
    .replace("</body>", () => `<script>${scriptSafe(code)}</script></body>`);
  return { html, media, htmlName };
}

// `pages` (several) or `page` (one). onProgress({ stage, done, total }) reports coarse steps.
export async function exportPage({ documentPath, documentRoot, page, pages, outFile, inlineLimit = 2 * 1024 * 1024, zip, single, compress, onProgress = () => {} } = {}) {
  let stem = "index";
  if (documentPath) {
    const document = realpathSync(documentPath);
    if (extname(document) !== ".md") throw new Error("Export needs a Markdown (.md) document.");
    documentRoot = dirname(document);
    stem = basename(document, ".md");
  }
  if (!documentRoot) throw new Error("Export needs a document or a document root.");
  pages = [...new Set(pages?.length ? pages : [page ?? (stem === "index" ? "/" : `/${stem}`)])];
  // The document may be the page itself (or any file in the site): climb to the directory the page path is relative to.
  if (documentPath) {
    for (let root = documentRoot; ; root = dirname(root)) {
      if (sourceFor(root, pages[0])) { documentRoot = root; break; }
      if (dirname(root) === root) break;
    }
  }
  const sources = pages.map(item => {
    const source = sourceFor(documentRoot, item);
    if (!source) throw new Error(`Page ${item} not found under ${documentRoot}. Pass any .md file in the site root, e.g. its index.md, or the page's own file.`);
    return source;
  });
  const many = pages.length > 1;
  if (single) {
    if (many) throw new Error("Single-file export takes one page.");
    inlineLimit = Infinity;
    zip = false;
  }
  const total = pages.length + 2;
  const warnings = [];
  onProgress({ stage: "Building site", done: 0, total });
  const workspace = await buildSite(documentRoot, sources);
  try {
    const dist = join(workspace, "dist");
    const rendered = [];
    // Optional lossy re-encode of videos (smaller, 960 px wide, no audio); originals are untouched.
    const encoded = new Map();
    const prepare = path => {
      if (!compress || !path || extname(path).toLowerCase() !== ".mp4") return path;
      if (!encoded.has(path)) {
        const out = join(workspace, `enc-${encoded.size}.mp4`);
        try {
          execFileSync("ffmpeg", ["-y", "-v", "error", "-i", path, "-vf", "scale='min(960,iw)':-2", "-c:v", "libx264", "-crf", "30", "-preset", "veryfast",
            "-an", "-movflags", "+faststart", "-pix_fmt", "yuv420p", out]);
          encoded.set(path, statSync(out).size < statSync(path).size ? out : path);
        } catch (error) {
          warnings.push(`Could not re-encode ${basename(path)}: ${String(error.message).split("\n")[0]}`);
          encoded.set(path, path);
        }
      }
      return encoded.get(path);
    };
    const links = many ? Object.fromEntries(pages.map(item => [normalPage(item), zipName(item, true)])) : {};
    for (const [index, item] of pages.entries()) {
      onProgress({ stage: `${compress ? "Re-encoding videos and packaging" : "Packaging"} ${item}`, done: index + 1, total });
      const prefix = many ? `${index}-` : "";
      const result = await renderPage(dist, item, inlineLimit, prefix, warnings, links, documentRoot, prepare);
      rendered.push({ ...result, page: item });
    }
    const media = rendered.flatMap(item => item.media);
    const asZip = many || (zip ?? media.length > 0);
    const first = rendered[0].htmlName;
    const target = resolve(outFile ?? `${many ? "pages" : basename(first, ".html") === "index" ? stem : basename(first, ".html")}.${asZip ? "zip" : "html"}`);
    onProgress({ stage: asZip ? "Zipping" : "Writing", done: total - 1, total });
    if (asZip) {
      const staging = join(workspace, "bundle");
      mkdirSync(join(staging, "media"), { recursive: true });
      for (const item of rendered) {
        const name = zipName(item.page, many);
        writeFileSync(join(staging, name), item.html);
      }
      for (const item of media) copyFileSync(item.path, join(staging, item.name));
      rmSync(target, { force: true });
      execFileSync("zip", ["-qr", target, "."], { cwd: staging });
    } else {
      writeFileSync(target, rendered[0].html);
    }
    onProgress({ stage: "Done", done: total, total });
    return { file: target, kind: asZip ? "zip" : "html", warnings, bytes: statSync(target).size };
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}
