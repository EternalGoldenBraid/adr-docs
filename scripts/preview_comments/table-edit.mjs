// Reads and rewrites one cell of an editable markdown table for the preview server, guarded by a hash of the file.
import { createHash } from "node:crypto";
import { cellOf, setCell } from "../../src/table-cells.mjs";
import { windowOf, replaceWindow } from "../../src/source-lines.mjs";

export const hashOf = text => createHash("sha256").update(text).digest("hex");

export function readCell(text, table, row, col) {
  return { raw: cellOf(text, table, row, col), hash: hashOf(text) };
}

export function writeCell(text, table, row, col, value, hash) {
  if (hash !== hashOf(text)) throw new Error("The page changed since you started editing. Reload and try again.");
  return setCell(text, table, row, col, value);
}

export function readWindow(text, start, end, radius) {
  return { ...windowOf(text, start, end, radius), hash: hashOf(text) };
}

export function writeWindow(text, from, to, value, hash) {
  if (hash !== hashOf(text)) throw new Error("The page changed since you started editing. Reload and try again.");
  return replaceWindow(text, from, to, value);
}
