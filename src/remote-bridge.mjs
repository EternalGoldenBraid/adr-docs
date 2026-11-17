import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureServer, resolveStore } from "./servers.mjs";

// Another agent's preview bridge: loopback port and token live in its connection.json (same user, mode 0600).
export async function remoteBridge(storageRoot, given, path, init = {}) {
  const store = resolveStore(storageRoot, given);
  if (!/^[\w-]{8,64}$/.test(store)) throw new Error("Invalid store session id.");
  const call = () => {
    const { port, token } = JSON.parse(readFileSync(join(storageRoot, store, "connection.json"), "utf8"));
    return fetch(`http://127.0.0.1:${port}${path}`, {
      ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    });
  };
  let response;
  try { response = await call(); } catch (error) {
    // A kept server that is down is started again on demand.
    if (!await ensureServer(storageRoot, store)) throw error;
    response = await call();
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Bridge answered ${response.status}`);
  return body;
}
