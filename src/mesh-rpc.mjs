// Bridge calls over the mesh, for agents on a machine that cannot reach the preview's loopback port.
// Request: "ADR-REQ <json>". Response: one or more "ADR-RES <id> <n>/<m> <base64 chunk>" messages (mesh messages are capped at 10 KB).
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const ALLOWED = /^\/(read|unanswered|agent-update|agent-add|agent-status)(\?|$)/;
const CHUNK = 6000;

export const encodeResponse = (id, payload) => {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64");
  const parts = Math.max(1, Math.ceil(data.length / CHUNK));
  return Array.from({ length: parts }, (_, i) => `ADR-RES ${id} ${i + 1}/${parts} ${data.slice(i * CHUNK, (i + 1) * CHUNK)}`);
};

export const parseResponse = content => {
  const match = /^ADR-RES (\S+) (\d+)\/(\d+) (\S*)$/.exec(content);
  return match && { id: match[1], part: Number(match[2]), parts: Number(match[3]), data: match[4] };
};

export const decodeResponse = chunks => JSON.parse(Buffer.from(chunks.join(""), "base64").toString("utf8"));

export async function loadMesh(databasePath = process.env.ADR_MESH_DB) {
  const directory = join(homedir(), ".copilot", "extensions", "agent-mesh");
  const [node, store, router, network] = await Promise.all(["node", "store", "router", "network"].map(file => import(pathToFileURL(join(directory, `${file}.mjs`)).href)));
  return { directory, node, store, router, network, databasePath: databasePath ?? join(directory, "agent-mesh.db") };
}
