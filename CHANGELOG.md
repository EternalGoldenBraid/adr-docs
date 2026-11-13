# Changelog

## 0.9.0 - 2026-11-13

- Scroll gutter: a tick at the right edge for every unresolved comment, positioned by its place in the whole page (text, graph nodes and edges). Click a tick to scroll to the comment; hover shows its text.

## 0.8.0 - 2026-11-13

- Comment markers sit at the comment: in the left margin beside commented text, on the top-right corner of a commented graph node, above a commented edge label. Overlapping markers are nudged apart; the fixed right-hand rail is gone.

## 0.7.1 - 2026-11-13

- Vim focus layers: the page owns the keys by default; clicking a `<DocGraph>` enters it (mode line `GRAPH · NORMAL`), and Esc in normal mode returns to the page. Only the clicked graph is active, and page motions no longer run while a graph is active.

## 0.7.0 - 2026-11-13

- `<DocGraph>`: a node `link` (e.g. `"/autonomy"`) opens that page on double-click or Enter, is withBase-aware, shows a `↗` badge, and can be edited in edit mode. External URLs also work.
- `<DocGraph back-to="/" back-label="Home">` adds an optional back link.
- `<DocGraph>`: node bodies keep line breaks, so `•` bullet lines render. `:help` documents links.

## 0.6.0 - 2026-11-13

- Region screenshots: `s` selects a region of the page and attaches the crop to a new comment or the open thread; images reach the agent as file paths (`imageFiles`).
- `<DocGraph>`: typing in the comment panel no longer drives the graph's keys.

## 0.5.1 - 2026-11-13

- `<DocGraph>`: edge labels are larger and use the edge colour.

## 0.5.0 - 2026-11-13

- Preview top bar links every top-level Markdown file (`nav:` front matter sets the label); fetched papers get a Back link.

## 0.4.0 - 2026-11-13

- `<DocGraph>`: tabs for lanes/topics (optional `tabs` prop) instead of a dropdown.
- `<DocGraph>`: bold node titles over regular body text.

## 0.3.0 - 2026-11-07

- Add comments on canvas targets (graph nodes and edges) alongside text.
- Add the `<DocGraph>` page component: an editable, layered graph with a normal/edit mode, trackpad controls and Vim modes.
- Add `tools/fetch_arxiv.py` to turn an arXiv HTML paper into a commentable page.
- Add `npm run preview -- <file.md>` to view a document without an agent session.
- Add `examples/`: a landing page with a live graph, an arXiv paper and a graph page (`npm run readme`).

## 0.2.0 - 2026-11-06

- Offer a contextual comment action and editor beside selected text or clicked content.
- Support inline SVG figures, SVG labels and document controls with current-value snapshots.
- Preserve native controls, keyboard selection, draft retries and the corner toolbar.

## 0.1.0 - 2026-11-05

- Extract the persistent browser comment workflow into an independent package.
- Package a pinned VitePress/MathJax preview and Copilot CLI extension.
- Keep read receipts, replies and explicit resolution separate.
- Preserve loopback-only access, session isolation and count-only attention.
