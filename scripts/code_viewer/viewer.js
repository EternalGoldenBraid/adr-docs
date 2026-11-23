// Read-only code viewer with Vim keys (CodeMirror 6). Bundled into viewer.bundle.js by `npm run build:code-viewer`.
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, keymap } from "@codemirror/view";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { vim, Vim } from "@replit/codemirror-vim";
import { search, searchKeymap } from "@codemirror/search";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
import { markdown } from "@codemirror/lang-markdown";
import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";

const LANGS = {
  py: python, js: javascript, mjs: javascript, ts: () => javascript({ typescript: true }), tsx: () => javascript({ typescript: true, jsx: true }),
  c: cpp, h: cpp, cc: cpp, cpp: cpp, hpp: cpp, md: markdown, json, yaml, yml: yaml,
};

const { repo, path, github } = window.__codeView;
const text = await (await fetch(`/__adr/code-raw/${repo}/${path}`)).text();
const ext = path.split(".").pop().toLowerCase();
const lineFromHash = () => Number(/^#L(\d+)/.exec(location.hash)?.[1]) || 1;

const contrast = EditorView.theme({
  ".cm-activeLine": { backgroundColor: "rgba(96,165,250,0.22)" },
  ".cm-activeLineGutter": { backgroundColor: "rgba(96,165,250,0.35)", color: "#fff" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "rgba(250,204,21,0.45) !important" },
  ".cm-fat-cursor, &.cm-focused > .cm-scroller > .cm-cursorLayer .cm-fat-cursor": { backgroundColor: "#facc15 !important", color: "#000 !important" },
}, { dark: true });

const view = new EditorView({
  parent: document.querySelector("#editor"),
  state: EditorState.create({
    doc: text,
    extensions: [
      vim(), lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(), oneDark, contrast, syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      search({ top: true }), keymap.of(searchKeymap), EditorState.readOnly.of(true), EditorView.contentAttributes.of({ "aria-readonly": "true" }),
      ...(LANGS[ext] ? [LANGS[ext]()] : []),
    ],
  }),
});

function goTo(line) {
  const at = view.state.doc.line(Math.min(Math.max(line, 1), view.state.doc.lines));
  view.dispatch({ selection: { anchor: at.from }, effects: EditorView.scrollIntoView(at.from, { y: "center" }) });
  view.focus();
}
goTo(lineFromHash());
addEventListener("hashchange", () => goTo(lineFromHash()));

const current = () => view.state.doc.lineAt(view.state.selection.main.head).number;
document.querySelector("#copy").addEventListener("click", () => {
  navigator.clipboard?.writeText(`vim +${current()} ${path}`);
  document.querySelector("#copy").textContent = "copied";
  setTimeout(() => { document.querySelector("#copy").textContent = "copy vim +line"; }, 1500);
});
const hub = document.querySelector("#github");
if (github) hub.href = `${github}#L${current()}`; else hub.hidden = true;
view.dom.addEventListener("keyup", () => { if (github) hub.href = `${github.split("#")[0]}#L${current()}`; });
Vim.defineEx("q", "q", () => (history.length > 1 ? history.back() : window.close()));

// c comments on the selected lines (the current line in normal mode): the page's review client works on the browser's own selection, so hand it one.
function commentOnSelection() {
  const { from, to, empty } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const a = empty ? line.from : from;
  const b = empty ? line.to : to;
  const start = view.domAtPos(a), end = view.domAtPos(b);
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  view.contentDOM.blur();
  getSelection().removeAllRanges();
  getSelection().addRange(range);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "c", bubbles: true }));
  requestAnimationFrame(() => { view.scrollDOM.scrollLeft = 0; });
}
Vim.defineAction("adrComment", commentOnSelection);
Vim.mapCommand("c", "action", "adrComment", {}, { context: "normal" });
Vim.mapCommand("c", "action", "adrComment", {}, { context: "visual" });
