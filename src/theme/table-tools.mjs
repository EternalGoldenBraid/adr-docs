// Sorting by several keys and grouping for any content table; the choice is remembered per page and table.
// Click a header to sort by it (again to reverse, a third time to clear); Shift+click adds it as a further key.
const KEY = "adr-table:";
const SEP = "\u0001";

const cellText = cell => (cell?.textContent ?? "").replace(/\s+/g, " ").trim();
// Numbers and ISO dates compare by value, everything else naturally and without case.
function comparable(text) {
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text;
  const number = Number.parseFloat(text.replace(/[,%\s]/g, ""));
  return /^[-+]?[\d.,]+\s*%?$/.test(text) && Number.isFinite(number) ? number : text.toLowerCase();
}
function compare(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a === "" || b === "") return a === b ? 0 : a === "" ? 1 : -1;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

export function enhanceTables(root = document, path = location.pathname) {
  const tables = [...root.querySelectorAll(".vp-doc table")].filter(table => !table.dataset.adrTable && table.tBodies[0]?.rows.length > 2 && table.tHead?.rows[0]);
  tables.forEach((table, index) => {
    table.dataset.adrTable = "1";
    const heads = [...table.tHead.rows[0].cells];
    const body = table.tBodies[0];
    const rows = [...body.rows];
    const id = `${KEY}${path}:${index}:${heads.map(cellText).join(SEP)}`;
    let state = { sort: [], group: -1 };
    try { state = { ...state, ...JSON.parse(localStorage.getItem(id) ?? "{}") }; } catch { /* ignore a corrupt value */ }
    state.sort = (state.sort ?? []).filter(key => key.col < heads.length);
    if (state.group >= heads.length) state.group = -1;

    const bar = document.createElement("div");
    bar.className = "adr-table-bar";
    const label = document.createElement("label");
    label.textContent = "Group by ";
    const select = document.createElement("select");
    select.append(new Option("(none)", "-1"), ...heads.map((head, col) => new Option(cellText(head), String(col))));
    label.append(select);
    const reset = document.createElement("button");
    reset.type = "button"; reset.textContent = "Reset";
    const hint = document.createElement("span");
    hint.className = "adr-table-hint"; hint.textContent = "Click a header to sort; Shift+click adds a key.";
    bar.append(label, reset, hint);
    table.before(bar);

    const collapsed = new Set();
    const values = rows.map(row => [...row.cells].map(cell => comparable(cellText(cell))));
    const render = () => {
      localStorage.setItem(id, JSON.stringify(state));
      select.value = String(state.group);
      heads.forEach((head, col) => {
        const at = state.sort.findIndex(key => key.col === col);
        head.dataset.sort = at < 0 ? "" : `${state.sort[at].dir < 0 ? "▼" : "▲"}${state.sort.length > 1 ? at + 1 : ""}`;
        head.classList.add("adr-sortable");
        head.setAttribute("aria-sort", at < 0 ? "none" : state.sort[at].dir < 0 ? "descending" : "ascending");
      });
      const order = rows.map((row, i) => i);
      order.sort((a, b) => {
        for (const { col, dir } of state.sort) {
          const result = compare(values[a][col], values[b][col]);
          if (result) return result * dir;
        }
        return a - b;
      });
      const out = [];
      let current;
      for (const i of order) {
        if (state.group >= 0) {
          const group = cellText(rows[i].cells[state.group]) || "(empty)";
          if (group !== current) {
            current = group;
            const count = order.filter(j => (cellText(rows[j].cells[state.group]) || "(empty)") === group).length;
            const header = document.createElement("tr");
            header.className = "adr-group";
            const cell = document.createElement("td");
            cell.colSpan = heads.length;
            cell.textContent = `${collapsed.has(group) ? "▸" : "▾"} ${cellText(heads[state.group])}: ${group} (${count})`;
            cell.addEventListener("click", () => { collapsed.has(group) ? collapsed.delete(group) : collapsed.add(group); render(); });
            header.append(cell);
            out.push(header);
          }
          rows[i].hidden = collapsed.has(group);
        } else rows[i].hidden = false;
        out.push(rows[i]);
      }
      body.replaceChildren(...out);
    };
    heads.forEach((head, col) => head.addEventListener("click", event => {
      const at = state.sort.findIndex(key => key.col === col);
      if (at < 0) state.sort = event.shiftKey ? [...state.sort, { col, dir: 1 }] : [{ col, dir: 1 }];
      else if (state.sort[at].dir > 0) state.sort = event.shiftKey ? state.sort.map((key, i) => i === at ? { col, dir: -1 } : key) : [{ col, dir: -1 }];
      else state.sort = state.sort.filter((key, i) => i !== at);
      render();
    }));
    select.addEventListener("change", () => { state.group = Number(select.value); render(); });
    reset.addEventListener("click", () => { state = { sort: [], group: -1 }; collapsed.clear(); render(); });
    if (state.sort.length || state.group >= 0) render(); else { heads.forEach(head => head.classList.add("adr-sortable")); }
  });
}
