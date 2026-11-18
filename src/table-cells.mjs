// Locates and rewrites one cell of an editable markdown table (see src/editable-tables.mjs). The Nth `{editable}` marker
// outside code fences names the table: the pipe rows directly above it, after one blank line. Shared by the preview server and the published site.
const MARKER = /^\{editable(?:\s*:\s*([^}]*))?\}\s*$/;
const splitRow = line => line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/);

function locate(text, table, row, col) {
  const lines = text.split("\n");
  let fence = null, count = -1, marker = -1;
  for (let i = 0; i < lines.length; i++) {
    const mark = /^\s*(`{3,}|~{3,})/.exec(lines[i]);
    if (mark) { fence = fence ? (mark[1][0] === fence ? null : fence) : mark[1][0]; continue; }
    if (!fence && MARKER.test(lines[i]) && ++count === table) { marker = i; break; }
  }
  if (marker < 0) throw new Error("That table is no longer marked editable. Reload the page.");
  let end = marker - 1;
  if (lines[end]?.trim() !== "") throw new Error("The table's marker must follow a blank line.");
  while (end >= 0 && lines[end].trim() === "") end--;
  let start = end;
  while (start > 0 && lines[start - 1].trim().startsWith("|")) start--;
  const head = splitRow(lines[start]).map(cell => cell.trim());
  const allowed = (MARKER.exec(lines[marker])[1] ?? "").split(",").map(name => name.trim()).filter(Boolean);
  if (col < 0 || col >= head.length || (allowed.length && !allowed.includes(head[col]))) throw new Error("That column is not editable.");
  const at = start + 2 + row;
  if (!Number.isInteger(row) || row < 0 || at > end) throw new Error("That row no longer exists. Reload the page.");
  const cells = splitRow(lines[at]);
  if (col >= cells.length) throw new Error("That cell no longer exists. Reload the page.");
  return { lines, at, cells };
}

export function cellOf(text, table, row, col) {
  return locate(text, table, row, col).cells[col].trim();
}

export function setCell(text, table, row, col, value) {
  if (typeof value !== "string" || value.length > 2000 || /[\r\n]/.test(value)) throw new Error("A cell takes one line of at most 2000 characters.");
  const { lines, at, cells } = locate(text, table, row, col);
  cells[col] = ` ${value.trim().replace(/(?<!\\)\|/g, "\\|")} `;
  lines[at] = `|${cells.join("|")}|`;
  return lines.join("\n");
}
