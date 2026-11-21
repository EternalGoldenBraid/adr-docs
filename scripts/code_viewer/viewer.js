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

const view = new EditorView({
  parent: document.querySelector("#editor"),
  state: EditorState.create({
    doc: text,
    extensions: [
      vim(), lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(), oneDark, syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
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
