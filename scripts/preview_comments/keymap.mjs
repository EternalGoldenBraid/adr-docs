import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const defaults = new URL("./keymap.json", import.meta.url);

function merge(base, extra) {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return extra ?? base;
  const out = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    out[key] = value && typeof value === "object" && !Array.isArray(value) && typeof base?.[key] === "object"
      ? merge(base[key], value) : value;
  }
  return out;
}

// Defaults plus the user's overrides; a broken user file is reported and ignored.
export function loadKeymap(env = process.env, log = console.error) {
  const base = JSON.parse(readFileSync(defaults, "utf8"));
  const file = env.ADR_KEYMAP || join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "agent-doc-review", "keymap.json");
  if (!existsSync(file)) return base;
  try { return merge(base, JSON.parse(readFileSync(file, "utf8"))); }
  catch (error) { log(`Ignoring ${file}: ${error.message}`); return base; }
}
