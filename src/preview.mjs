import { mkdirSync, mkdtempSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "vitepress";
import { startCommentBridge } from "../scripts/preview_comments/server.mjs";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));

export async function startDocumentPreview({
  documentPath, sessionId, storageRoot, notify, onError, port = 0, ownerViaMesh = false, name, onRestart, inSite = false,
}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("Preview port must be an integer from 0 to 65535.");
  }
  if (typeof notify !== "function" || typeof onError !== "function") {
    throw new Error("A comment notification callback and error reporter are required.");
  }
  if (typeof sessionId !== "string" || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(sessionId)) {
    throw new Error("A UUID identifying the owning session is required.");
  }
  if (typeof documentPath !== "string" || !isAbsolute(documentPath)) {
    throw new Error("An absolute Markdown document path is required.");
  }
  const document = realpathSync(documentPath);
  if (!statSync(document).isFile() || extname(document) !== ".md") {
    throw new Error("The preview requires an existing Markdown (.md) file.");
  }
  const documentRoot = dirname(document);
  mkdirSync(storageRoot, { recursive: true, mode: 0o700 });
  const workspace = mkdtempSync(join(storageRoot, "preview-"));
  const configDirectory = join(workspace, ".vitepress");
  const connectionFile = join(storageRoot, sessionId, "connection.json");
  const configModule = pathToFileURL(join(packageRoot, "src/vitepress-config.mjs")).href;

  let server;
  let bridge;
  let node;
  // Notes to addressed agents go out at high priority: they carry the human's words, and a quiet hint (70 characters, "may postpone") was being ignored.
  // They go out as a non-agent mesh node, joined on first use; absent mesh means no notes.
  const mesh = { async send(session, content) {
    if (!node) {
      const module = await import(pathToFileURL(join(homedir(), ".copilot", "extensions", "agent-mesh", "node.mjs")).href);
      node = module.joinMesh({ name: "agent-doc-review-site", kind: "site", cwd: documentRoot });
    }
    const result = node.send({ recipient_session_id: session, content, priority: "high" });
    if (result?.error) throw new Error(result.error);
  } };
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    const results = await Promise.allSettled([
      ...(server ? [server.close()] : []),
      ...(bridge ? [bridge.close()] : []),
    ]);
    try { node?.close(); } catch { /* ignore */ }
    rmSync(workspace, { recursive: true });
    const errors = results.filter(result => result.status === "rejected").map(result => result.reason);
    if (errors.length) throw new AggregateError(errors, "Preview cleanup failed.");
  }
  try {
    mkdirSync(configDirectory);
    // Keep document-relative assets and renderer dependencies under one disposable root.
    symlinkSync(documentRoot, join(workspace, "source"), "junction");
    symlinkSync(join(packageRoot, "node_modules"), join(workspace, "node_modules"), "junction");
    mkdirSync(join(configDirectory, "theme"));
    writeFileSync(join(configDirectory, "theme", "index.mjs"),
      `export { default } from ${JSON.stringify(join(packageRoot, "src/theme/index.mjs"))};\n`);
    writeFileSync(join(configDirectory, "config.mjs"),
      `import { previewConfig } from ${JSON.stringify(configModule)};\n` +
      `export default previewConfig(${JSON.stringify({ documentRoot, connectionFile, workspace, packageRoot })});\n`);
    let listenPort = port;
    // VitePress calls this when the config file changes (the page tree touches it); keep the port so the origin stays valid.
    const recreate = async () => {
      await server.close();
      server = await createServer(workspace, { host: "127.0.0.1", port: listenPort, strictPort: true }, recreate);
      await server.listen();
    };
    server = await createServer(workspace, { host: "127.0.0.1", port, strictPort: port !== 0 }, recreate);
    await server.listen();
    const address = server.httpServer.address();
    listenPort = address.port;
    const origin = `http://127.0.0.1:${address.port}`;
    bridge = await startCommentBridge({ sessionId, documentRoot, storageRoot, dataDirectory: inSite ? join(documentRoot, ".adr-data") : undefined, previewOrigin: origin, notify, onError, mesh, ownerViaMesh, name, onRestart });
    const stem = basename(document, ".md");
    const url = origin + (stem === "index" ? "/" : "/" + encodeURIComponent(stem));
    return { url, origin, document, documentRoot, workspace, bridge, close };
  } catch (error) {
    try { await close(); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], "Preview startup and cleanup failed."); }
    throw error;
  }
}
