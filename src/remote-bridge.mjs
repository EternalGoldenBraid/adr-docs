import { readFileSync } from "node:fs";
import { join } from "node:path";

// Another agent's preview bridge: loopback port and token live in its connection.json (same user, mode 0600).
export async function remoteBridge(storageRoot, store, path, init = {}) {
  if (!/^[\w-]{8,64}$/.test(store)) throw new Error("Invalid store session id.");
  const { port, token } = JSON.parse(readFileSync(join(storageRoot, store, "connection.json"), "utf8"));
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Bridge answered ${response.status}`);
  return body;
}
