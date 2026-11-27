// Bridge calls over the mesh, for agents on a machine that cannot reach the preview's loopback port.
// Request: "ADR-REQ <json>". Response: one or more "ADR-RES <id> <n>/<m> <base64 chunk>" messages (mesh messages are capped at 10 KB).
import { gunzipSync, gzipSync } from "node:zlib";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const ALLOWED = /^\/(read|unanswered|agent-update|agent-add|agent-status|agent-vote|agent-waiting)(\?|$)/;
const CHUNK = 9000; // the mesh allows about nine sends per pair in a short window, so a response must fit in few chunks

export const encodeResponse = (id, payload) => {
  const data = gzipSync(JSON.stringify(payload)).toString("base64");
  const parts = Math.max(1, Math.ceil(data.length / CHUNK));
  return Array.from({ length: parts }, (_, i) => `ADR-RES ${id} ${i + 1}/${parts} ${data.slice(i * CHUNK, (i + 1) * CHUNK)}`);
};

// The mesh refuses more than about nine sends per pair, and a read is marked seen before it is sent, so a thread list that does not fit
// would be lost. Shrink it to MAX_PARTS chunks instead: keep each thread's latest replies, then cut long texts, and say what was cut.
export const MAX_PARTS = 8;
const clip = (text, size) => typeof text === "string" && text.length > size ? `${text.slice(0, size)} […cut ${text.length - size} characters; read the thread in the page for the rest]` : text;
export const fitResponse = (payload, maxParts = MAX_PARTS) => {
  const comments = payload?.body?.comments;
  if (!Array.isArray(comments) || encodeResponse("x", payload).length <= maxParts) return payload;
  for (const [keep, size] of [[6, 4000], [3, 1500], [1, 700], [0, 300]]) {
    const slim = comments.map(({ input, ...comment }) => ({
      ...comment, comment: clip(comment.comment, size), quote: clip(comment.quote, size),
      replies: (keep ? (comment.replies ?? []).slice(-keep) : []).map(reply => ({ ...reply, reply: clip(reply.reply, size) })),
      ...((comment.replies ?? []).length > keep ? { repliesOmitted: (comment.replies ?? []).length - keep } : {}),
    }));
    const fitted = { ...payload, body: { ...payload.body, comments: slim, trimmed: "Shortened to fit the mesh; older replies and long texts were cut. The full threads are on the page." } };
    if (encodeResponse("x", fitted).length <= maxParts) return fitted;
  }
  return { ...payload, body: { ...payload.body, comments: comments.slice(0, 20).map(c => ({ id: c.id, url: c.url, comment: clip(c.comment, 300), replies: [] })), trimmed: "Too large for the mesh; only the first threads, cut short." } };
};

export const parseResponse = content => {
  const match = /^ADR-RES (\S+) (\d+)\/(\d+) (\S*)$/.exec(content);
  return match && { id: match[1], part: Number(match[2]), parts: Number(match[3]), data: match[4] };
};

export const decodeResponse = chunks => {
  const bytes = Buffer.from(chunks.join(""), "base64");
  return JSON.parse((bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString("utf8"));
};

export async function loadMesh(databasePath = process.env.ADR_MESH_DB) {
  const directory = join(homedir(), ".copilot", "extensions", "agent-mesh");
  const [node, store, router, network] = await Promise.all(["node", "store", "router", "network"].map(file => import(pathToFileURL(join(directory, `${file}.mjs`)).href)));
  return { directory, node, store, router, network, databasePath: databasePath ?? join(directory, "agent-mesh.db") };
}
