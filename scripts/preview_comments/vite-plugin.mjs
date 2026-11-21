import { readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { loadKeymap } from "./keymap.mjs";
import { handleCode } from "../code_viewer/serve.mjs";

const base = "/__preview_comments";

export function previewComments({ connectionFile }) {
  return {
    name: "local-preview-comments",
    apply: "serve",
    transformIndexHtml: () => [{
      tag: "script", attrs: { src: `${base}/client.js`, defer: true }, injectTo: "body",
    }],
    configureServer(server) {
      if (server.config.server.host !== "127.0.0.1") {
        throw new Error("Preview comments require a loopback-only Vite server.");
      }
      server.middlewares.use((request, response, next) => {
        if (handleCode(request, response, [server.config.publicDir, server.config.root])) return;
        if (!request.url?.startsWith(base + "/")) return next();
        const fail = (status, error) => {
          response.writeHead(status, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ error }));
        };
        if (request.method === "GET" && request.url === `${base}/client.js`) {
          response.writeHead(200, {
            "Content-Type": "text/javascript", "Cache-Control": "no-store",
          });
          const keymap = loadKeymap(process.env, message => server.config.logger.warn(message));
          return response.end(`window.__adrKeymap=${JSON.stringify(keymap)};\n` +
            readFileSync(new URL("./client.js", import.meta.url), "utf8"));
        }
        let connection;
        try { connection = JSON.parse(readFileSync(connectionFile, "utf8")); }
        catch (error) {
          server.config.logger.error(`Preview comments: ${error.message}`);
          return fail(503, "Comment bridge is offline. Your draft is kept.");
        }
        const origin = connection.previewOrigin;
        // The same server answers as 127.0.0.1, localhost and NAME.localhost on its own port.
        const preview = new URL(origin);
        const ownHost = value => { try { const u = new URL(`http://${value}`); return u.port === preview.port && /^(127\.0\.0\.1|localhost|[a-z0-9-]+\.localhost)$/.test(u.hostname); } catch { return false; } };
        if (!ownHost(request.headers.host ?? "") ||
            (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) ||
            request.headers["x-preview-comment"] !== "1") {
          return fail(403, "Only the configured preview may access comments.");
        }
        const path = request.url.slice(base.length);
        const known = ["/status", "/comments", "/history", "/history-recent", "/viewed", "/whatsnew", "/pagelinks", "/touch", "/votes", "/vote", "/labels", "/updates", "/attachments", "/userseen", "/settings", "/bell", "/mesh", "/faces", "/face-open", "/face-post", "/restart", "/tts", "/table-edit"].includes(path) ||
          request.method === "GET" && (/^\/(attachments|tts)\/[\da-f]{64}$/.test(path) || /^\/faces\/[\w-]{1,64}$/.test(path));
        if (!known) return fail(404, "Unknown comment endpoint.");
        const upstream = httpRequest({
          hostname: "127.0.0.1", port: connection.port, path, method: request.method,
          headers: { "Content-Type": request.headers["content-type"] || "application/json", Authorization: `Bearer ${connection.token}` },
        }, result => {
          response.writeHead(result.statusCode, {
            "Content-Type": result.headers["content-type"] || "application/json",
            "Cache-Control": result.headers["cache-control"] || "no-store",
          });
          result.pipe(response);
        });
        upstream.on("error", error => {
          server.config.logger.error(`Preview comments: ${error.message}`);
          fail(503, "Comment bridge is offline. Your draft is kept.");
        });
        request.pipe(upstream);
      });
    },
  };
}
