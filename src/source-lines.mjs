// Source view for the preview: block tokens get `data-adr-src="start,end"` (0-based lines of the body, end exclusive),
// and the helpers read and replace a window of lines in the page file.
export default function sourceLines(md) {
  md.core.ruler.push("adr-source-lines", state => {
    for (const token of state.tokens) {
      if (token.level !== 0 || !token.map || token.nesting === -1) continue;
      token.attrSet("data-adr-src", token.map.join(","));
    }
  });
}

// Lines the front matter takes; markdown-it sees the body after it.
export function bodyOffset(text) {
  const lines = text.split("\n");
  if (lines[0].trimEnd() !== "---") return 0;
  const close = lines.findIndex((line, i) => i > 0 && line.trimEnd() === "---");
  return close < 0 ? 0 : close + 1;
}

export function windowOf(text, start, end, radius) {
  const lines = text.split("\n");
  const offset = bodyOffset(text);
  const from = Math.max(offset, start + offset - radius);
  const to = Math.min(lines.length, end + offset + radius);
  return { from, to, raw: lines.slice(from, to).join("\n"), focus: [start + offset - from, end + offset - from] };
}

export function replaceWindow(text, from, to, value) {
  const lines = text.split("\n");
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to > lines.length) throw new Error("Invalid line range.");
  lines.splice(from, to - from, ...value.split("\n"));
  return lines.join("\n");
}
