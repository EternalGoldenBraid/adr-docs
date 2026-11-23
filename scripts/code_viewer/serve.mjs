import { readFileSync, realpathSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";

const MAX_BYTES = 2 * 1024 * 1024;
const HOST = /^(127\.0\.0\.1|localhost|[a-z0-9-]+\.localhost)(:\d+)?$/;
const esc = value => String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

// Repos come from the site's code-repos.json: {repo: {local, github, ref}}. Only mapped repos are readable.
export function loadRepos(dirs) {
  for (const dir of dirs) {
    try { return JSON.parse(readFileSync(join(dir, "code-repos.json"), "utf8")); } catch { /* try the next folder */ }
  }
  return {};
}

// A file is served only from inside a mapped checkout, never from a dot-folder or a secret-looking name.
export function readCode(repos, repo, path) {
  const entry = Object.hasOwn(repos, repo) ? repos[repo] : null;
  if (!entry?.local) return { status: 404, error: "Unknown repo. Add it to code-repos.json." };
  const parts = path.split("/");
  if (parts.some(part => part === ".." || part.startsWith(".")) || /\.(pem|key|p12)$|secret|credential/i.test(path)) return { status: 403, error: "Not served." };
  let root, file;
  try { root = realpathSync(entry.local); file = realpathSync(resolve(root, path)); } catch { return { status: 404, error: "No such file." }; }
  if (file !== root && !file.startsWith(root + sep)) return { status: 403, error: "Outside the checkout." };
  const info = statSync(file);
  if (!info.isFile() || info.size > MAX_BYTES) return { status: 413, error: "Not a file, or larger than 2 MB." };
  return { status: 200, text: readFileSync(file, "utf8"), entry };
}

const page = (repo, path, github) => `<!doctype html><meta charset="utf-8"><title>${esc(repo)}:${esc(path)}</title>
<style>body{margin:0;background:#282c34;color:#abb2bf;font:13px system-ui;display:flex;flex-direction:column;height:100vh}
header{display:flex;gap:10px;align-items:center;padding:6px 12px;background:#21252b;border-bottom:1px solid #3a404a}
header b{font:13px ui-monospace,monospace;color:#8ab4f8;flex:1}header a,header button{color:inherit;background:none;border:1px solid #59616d;border-radius:6px;padding:2px 9px;font:inherit;cursor:pointer;text-decoration:none}
#doc{flex:1;min-height:0;overflow:hidden}#editor{height:100%}.cm-editor{height:100%}.cm-scroller{font:13px ui-monospace,monospace}small{opacity:.6}</style>
<header><b>${esc(repo)}:${esc(path)}</b><small>Vim keys · read-only · :q goes back</small><button id="copy" type="button">copy vim +line</button><a id="github" target="_blank" rel="noopener">GitHub</a></header>
<div class="vp-doc" id="doc"><div id="editor"></div></div>
<script>window.__codeView=${JSON.stringify({ repo, path, github }).replace(/</g, "\\u003c")}</script>
<script type="module" src="/__adr/code-viewer.js"></script>
<script src="/__preview_comments/client.js" defer></script>`;

// /__adr/code/<repo>/<path> is the page, /__adr/code-raw/... the text, /__adr/code-viewer.js the bundle.
export function handleCode(request, response, dirs) {
  const url = request.url?.split(/[?#]/)[0] ?? "";
  if (!url.startsWith("/__adr/code")) return false;
  const send = (status, type, body) => { response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" }); response.end(body); };
  if (request.method !== "GET" || !HOST.test(request.headers.host ?? "")) { send(403, "text/plain", "Only the local preview may read code."); return true; }
  if (url === "/__adr/code-viewer.js") { send(200, "text/javascript", readFileSync(new URL("./viewer.bundle.js", import.meta.url))); return true; }
  const match = /^\/__adr\/(code|code-raw)\/([^/]+)\/(.+)$/.exec(url);
  if (!match) { send(404, "text/plain", "Unknown code route."); return true; }
  let path;
  try { path = decodeURIComponent(match[3]); } catch { send(400, "text/plain", "Bad path."); return true; }
  const found = readCode(loadRepos(dirs), decodeURIComponent(match[2]), path);
  if (found.status !== 200) { send(found.status, "text/plain", found.error); return true; }
  if (match[1] === "code-raw") send(200, "text/plain; charset=utf-8", found.text);
  else send(200, "text/html; charset=utf-8", page(decodeURIComponent(match[2]), path, found.entry.github ? `${found.entry.github.replace(/\/$/, "")}/blob/${found.entry.ref || "main"}/${path}` : ""));
  return true;
}
