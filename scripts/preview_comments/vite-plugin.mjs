import { readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";

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
        if (!request.url?.startsWith(base + "/")) return next();
        const fail = (status, error) => {
          response.writeHead(status, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ error }));
        };
        if (request.method === "GET" && request.url === `${base}/client.js`) {
          response.writeHead(200, {
            "Content-Type": "text/javascript", "Cache-Control": "no-store",
          });
          return response.end(readFileSync(new URL("./client.js", import.meta.url)));
        }
        let connection;
        try { connection = JSON.parse(readFileSync(connectionFile, "utf8")); }
        catch (error) {
          server.config.logger.error(`Preview comments: ${error.message}`);
          return fail(503, "Comment bridge is offline. Your draft is kept.");
        }
        const origin = connection.previewOrigin;
        if (request.headers.host !== new URL(origin).host ||
            (request.headers.origin && request.headers.origin !== origin) ||
            request.headers["x-preview-comment"] !== "1") {
          return fail(403, "Only the configured preview may access comments.");
        }
        const path = request.url.slice(base.length);
        if (!["/status", "/comments", "/history", "/updates"].includes(path)) return fail(404, "Unknown comment endpoint.");
        const upstream = httpRequest({
          hostname: "127.0.0.1", port: connection.port, path, method: request.method,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${connection.token}` },
        }, result => {
          response.writeHead(result.statusCode, {
            "Content-Type": "application/json", "Cache-Control": "no-store",
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
