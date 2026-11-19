// Line diff of a page against the copy you last viewed. Pages are small, so a plain LCS table is enough.
export function diffLines(before, after) {
  const a = before === undefined ? [] : before.split("\n");
  const b = after.split("\n");
  const table = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) {
    table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  }
  const rows = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { rows.push({ op: " ", text: a[i], line: j + 1 }); i++; j++; }
    else if (i < a.length && (j === b.length || table[i + 1][j] >= table[i][j + 1])) { rows.push({ op: "-", text: a[i], line: j + 1 }); i++; }
    else { rows.push({ op: "+", text: b[j], line: j + 1 }); j++; }
  }
  return rows;
}

// Changed rows with `context` unchanged lines around them, merged into hunks.
export function hunks(rows, context = 2) {
  const keep = new Set();
  rows.forEach((row, index) => { if (row.op !== " ") for (let k = index - context; k <= index + context; k++) if (rows[k]) keep.add(k); });
  const out = [];
  let current;
  rows.forEach((row, index) => {
    if (!keep.has(index)) { current = undefined; return; }
    if (!current) out.push(current = { line: row.line, rows: [] });
    current.rows.push(row);
  });
  return out;
}
