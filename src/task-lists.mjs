// GFM task lists for markdown-it: `- [ ] a` / `- [x] b` become read-only checkboxes.
export default function taskLists(md) {
  md.core.ruler.after("inline", "adr-task-lists", state => {
    const tokens = state.tokens;
    for (let i = 2; i < tokens.length; i++) {
      const inline = tokens[i];
      if (inline.type !== "inline" || tokens[i - 1].type !== "paragraph_open" || tokens[i - 2].type !== "list_item_open") continue;
      const first = inline.children?.[0];
      const match = first?.type === "text" && /^\[([ xX])\]\s+/.exec(first.content);
      if (!match) continue;
      first.content = first.content.slice(match[0].length);
      const box = new state.Token("html_inline", "", 0);
      box.content = `<input class="task-box" type="checkbox" disabled${match[1] === " " ? "" : " checked"}> `;
      inline.children.unshift(box);
      tokens[i - 2].attrJoin("class", "task-item");
    }
  });
}
