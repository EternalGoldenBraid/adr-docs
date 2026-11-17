// Arguments of the standalone `adr` command: what to serve, on which port, into which comment store.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { isBlockedPort, siteStore } from "./servers.mjs";

export const USAGE = "usage: adr <dir | file.md> [port] [--port N] [--store UUID] [--name NAME] [-d]\n       adr list    show running ADR servers\n       adr tui     browse, restart and stop them (-d runs a server in the background)";
const UUID = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;

// A directory is served from its index.md. Its comment store is, in order: --store, the UUID in
// <dir>/.adr-store (so a site keeps one store whoever launches it), or a hash of the served path.
export function resolveLaunch(argv, cwd = process.cwd(), storageRoot) {
  const positional = [];
  let port;
  let store;
  let detach = false;
  let name;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--detach" || arg === "-d") {
      detach = true;
    } else if (arg === "--port" || arg === "--store" || arg === "--name") {
      if (i + 1 >= argv.length) throw new Error(`${arg} needs a value`);
      if (arg === "--port") port = argv[++i];
      else if (arg === "--name") name = argv[++i];
      else store = argv[++i];
    } else if (arg.startsWith("--")) {
      throw new Error(`unknown option ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  const [target, portArg, ...extra] = positional;
  if (!target || extra.length) throw new Error("expected a directory or Markdown file, then an optional port");
  if (portArg !== undefined) {
    if (port !== undefined) throw new Error("port given twice");
    port = portArg;
  }
  if (port !== undefined && !/^\d+$/.test(port)) throw new Error(`port must be a number, got ${port}`);
  if (port !== undefined && isBlockedPort(port)) throw new Error(`port ${port} is blocked by browsers (ERR_UNSAFE_PORT); pick another, e.g. 5180`);
  const path = resolve(cwd, target);
  if (!existsSync(path)) throw new Error(`${path} does not exist`);
  const directory = statSync(path).isDirectory();
  const document = directory ? join(path, "index.md") : path;
  if (!existsSync(document)) throw new Error(`${path} has no index.md`);
  const pin = directory ? join(path, ".adr-store") : null;
  if (store === undefined && pin && existsSync(pin)) store = readFileSync(pin, "utf8").trim();
  if (name !== undefined && !/^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/.test(name)) throw new Error("name must be lowercase letters, digits and dashes (it becomes NAME.localhost)");
  if (store !== undefined && !UUID.test(store)) throw new Error(`store must be a UUID, got ${store}`);
  if (store === undefined && directory && storageRoot) store = siteStore(storageRoot, path);
  if (store === undefined) {
    const hex = createHash("sha256").update(document).digest("hex");
    store = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  }
  return { document, port: port === undefined ? 0 : Number(port), store, detach, name };
}
