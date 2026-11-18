// Editable tables for markdown-it: a table followed by a blank line and `{editable}` (all columns) or
// `{editable: Col A, Col B}` becomes `data-adr-edit="N"` (N counts the markers on the page), its editable columns
// `data-adr-cols="0,2"` and its position `data-adr-row` on every body row. The preview writes edits back into the markdown file.
export const MARKER = /^\{editable(?:\s*:\s*([^}]*))?\}$/;

export default function editableTables(md) {
  md.core.ruler.after("inline", "adr-editable-tables", state => {
    const tokens = state.tokens;
    let count = 0;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== "table_close") continue;
      const [open, inline, close] = [tokens[i + 1], tokens[i + 2], tokens[i + 3]];
      const match = open?.type === "paragraph_open" && close?.type === "paragraph_close" && MARKER.exec(inline.content.trim());
      if (!match) continue;
      let start = i;
      while (tokens[start].type !== "table_open") start--;
      const heads = [];
      let row = 0, body = false;
      const rows = [];
      for (let j = start; j < i; j++) {
        if (tokens[j].type === "tbody_open") body = true;
        if (tokens[j].type === "th_open") heads.push(tokens[j + 1].content.trim());
        if (body && tokens[j].type === "tr_open") { tokens[j].attrSet("data-adr-row", String(row++)); rows.push(tokens[j]); }
      }
      const wanted = match[1]?.split(",").map(name => name.trim()).filter(Boolean);
      const cols = heads.map((head, index) => index).filter(index => !wanted || wanted.includes(heads[index])).join(",");
      // VitePress renders its own <table>, so the marks live on the rows.
      for (const tr of rows) { tr.attrSet("data-adr-edit", String(count)); tr.attrSet("data-adr-cols", cols); }
      count++;
      tokens.splice(i + 1, 3);
    }
  });
}
