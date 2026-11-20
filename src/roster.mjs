import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const UUID = /[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/i;
// The bare session id inside a mesh address such as "remote:[gpu]<id>"; anything else comes back unchanged.
export const bareSession = id => String(id).match(UUID)?.[0] ?? id;
const cells = line => line.trim().replace(/^\||\|$/g, "").split("|").map(cell => cell.trim());
// "Demo agent" is "demo-agent"; `legacySlug` is the older form that dropped the accent ("m-kki-agent") and is still accepted.
export const legacySlug = text => text.toLowerCase().replace(/[^a-z\d]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
export const slugify = text => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z\d]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

// The team page is the roster: a Markdown table whose header has "Who" and "Session". Optional columns:
// Role, Machine, Harness, Topic, Working on, Reports to (the views of <TeamGraph />). Rows with a session id are agents and become the comment recipients.
// The page is `team-page:` in the root index.md front matter, default `team.md`.
export function readRoster(documentRoot) {
  const index = join(documentRoot, "index.md");
  const front = existsSync(index) ? readFileSync(index, "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "" : "";
  const page = front.match(/^team-page:\s*(.+)$/m)?.[1].trim().replace(/^["']|["']$/g, "") ?? "team";
  const file = join(documentRoot, page.replace(/\.md$/, "") + ".md");
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, "utf8").split("\n");
  const start = lines.findIndex(line => {
    const header = cells(line).map(cell => cell.toLowerCase());
    return line.trim().startsWith("|") && header.includes("who") && header.some(cell => cell.startsWith("session"));
  });
  if (start < 0) return [];
  const header = cells(lines[start]).map(cell => cell.toLowerCase());
  const column = name => header.findIndex(cell => cell === name || cell.startsWith(name));
  const [who, role, machine, session, harness, work, topic, reports] = ["who", "role", "machine", "session", "harness", "working", "topic", "reports"].map(column);
  const rows = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.trim().startsWith("|")) break;
    const row = cells(line);
    const name = row[who]?.replace(/[*_`]/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim();
    if (!name) continue;
    rows.push({
      name, slug: slugify(name), ...(legacySlug(name) !== slugify(name) ? { legacy: legacySlug(name) } : {}), role: row[role] ?? "", machine: row[machine]?.replace(/[`—-]+$/, "") ?? "",
      harness: row[harness]?.replace(/[`—-]+$/, "") ?? "", work: row[work]?.replace(/^[—-]+$/, "") ?? "", topic: row[topic]?.replace(/^[—-]+$/, "") ?? "",
      reportsTo: row[reports]?.replace(/^[—-]+$/, "") ?? "", session: row[session]?.match(UUID)?.[0] ?? "",
    });
  }
  return rows;
}
