// Running ADR servers, found through the connection.json each comment bridge writes into its store.
import { readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

// Ports Chrome and Firefox refuse to open (ERR_UNSAFE_PORT), so a server there looks dead.
const BLOCKED = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102, 103, 104, 109, 110,
  111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532,
  540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061,
  6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080,
]);
export const isBlockedPort = port => BLOCKED.has(Number(port));

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
}

// Servers whose process is gone leave a stale connection.json; `prune` removes it.
export function listServers(storageRoot, { prune = false } = {}) {
  const rows = [];
  let stores = [];
  try { stores = readdirSync(storageRoot); } catch { return rows; }
  for (const store of stores) {
    const file = join(storageRoot, store, "connection.json");
    let info;
    try { info = JSON.parse(readFileSync(file, "utf8")); } catch { continue; }
    if (!info.pid) continue; // written by an older version, cannot tell if it is running
    if (!alive(info.pid)) {
      if (prune) try { unlinkSync(file); } catch { /* already gone */ }
      continue;
    }
    rows.push({ store, url: info.previewOrigin, pid: info.pid, root: info.documentRoot, startedAt: info.startedAt });
  }
  return rows.sort((a, b) => String(a.url).localeCompare(String(b.url)));
}
