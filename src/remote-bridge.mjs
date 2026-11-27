import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { decodeResponse, loadMesh, parseResponse } from "./mesh-rpc.mjs";
import { ensureServer, resolveStore } from "./servers.mjs";

// remote.json in the state directory ({"machine": "my-laptop"}) names the machine whose previews are reached over the mesh,
// used for a store this machine does not run itself.
export const remoteMachine = storageRoot => {
  try { return JSON.parse(readFileSync(join(storageRoot, "remote.json"), "utf8")).machine; } catch { return undefined; }
};

async function meshBridge(machine, store, path, init, timeoutMs = 30_000) {
  const { node, store: storeModule, router: routerModule, network, databasePath } = await loadMesh();
  const me = node.joinMesh({ name: "adr-client", kind: "script", databasePath });
  const database = storeModule.openStore(databasePath);
  try {
    const router = routerModule.createRouter(database, network.loadMachines());
    const peers = await router.listAgents(me.sessionId, { status: "active", machine });
    // Short-lived relay sessions pile up for one store; the one heard from last is the live one.
    // A store id (not the folder name) matches no cwd, so every relay is a candidate and each one checks the store itself.
    const heard = agent => String(agent.last_heartbeat ?? agent.lastHeartbeat ?? "");
    const relays = (peers.agents ?? []).filter(agent => agent.repo === "agent-doc-review-site").sort((a, b) => heard(b).localeCompare(heard(a)));
    const named = relays.filter(agent => basename(agent.cwd ?? "") === store);
    const targets = (named.length ? named : relays).slice(0, 3);
    if (!targets.length) throw new Error(`No running preview "${store}" on ${machine}.`);
    let refused;
    for (const target of targets) {
      const id = randomUUID();
      const sent = await router.sendMessage(me.sessionId, { machine, recipient_session_id: target.session_id, priority: "high",
        content: `ADR-REQ ${JSON.stringify({ id, store, path, method: init.method ?? "GET", body: init.body })}` });
      if (sent.error) throw new Error(sent.error);
      const chunks = new Map();
      // With several candidates each gets a short turn: a relay of another store (or an old preview) may never answer.
      const turn = targets.length > 1 ? Math.min(timeoutMs, 12_000) : timeoutMs;
      for (const deadline = Date.now() + turn; Date.now() < deadline; await new Promise(done => setTimeout(done, 400))) {
        for (const message of me.inbox().messages ?? []) {
          const part = parseResponse(message.content);
          if (part?.id !== id) continue;
          me.read(message.message_id);
          chunks.set(part.part, part);
          if (chunks.size === part.parts) {
            const { status, body } = decodeResponse([...chunks.keys()].sort((a, b) => a - b).map(key => chunks.get(key).data));
            if (status === 404 && /This preview serves/.test(body?.error ?? "")) { refused = body.error; break; }
            if (status >= 400) throw new Error(body.error || `Bridge answered ${status}`);
            return body;
          }
        }
        if (refused) break;
      }
      if (target === targets.at(-1)) throw new Error(refused ?? `No answer from the preview "${store}" on ${machine} within ${timeoutMs / 1000} s.`);
      refused = undefined;
    }
  } finally { me.close(); database.close(); }
}

// Another agent's preview bridge: loopback port and token live in its connection.json (same user, mode 0600).
export async function remoteBridge(storageRoot, given, path, init = {}) {
  const machine = remoteMachine(storageRoot);
  let store;
  try { store = resolveStore(storageRoot, given); } catch (error) { if (!machine || typeof given !== "string") throw error; }
  if (machine && (!store || !existsSync(join(storageRoot, store, "connection.json")))) return meshBridge(machine, given, path, init);
  if (!/^[\w-]{8,64}$/.test(store)) throw new Error(`Invalid store "${store}". Store names need ADR 0.67 or newer: reload the plugin, or pass the store id.`);
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
