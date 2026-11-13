import { mkdirSync, mkdtempSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "vitepress";
import { startCommentBridge } from "../scripts/preview_comments/server.mjs";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));

export async function startDocumentPreview({
  documentPath, sessionId, storageRoot, notify, onError, port = 0,
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
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    const results = await Promise.allSettled([
      ...(server ? [server.close()] : []),
      ...(bridge ? [bridge.close()] : []),
    ]);
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
    server = await createServer(workspace, { host: "127.0.0.1", port, strictPort: port !== 0 });
    await server.listen();
    const address = server.httpServer.address();
    const origin = `http://127.0.0.1:${address.port}`;
    bridge = await startCommentBridge({ sessionId, documentRoot, storageRoot, previewOrigin: origin, notify, onError });
    const stem = basename(document, ".md");
    const url = origin + (stem === "index" ? "/" : "/" + encodeURIComponent(stem));
    return { url, origin, document, documentRoot, workspace, bridge, close };
  } catch (error) {
    try { await close(); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], "Preview startup and cleanup failed."); }
    throw error;
  }
}
