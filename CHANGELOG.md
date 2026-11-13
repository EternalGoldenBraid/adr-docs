# Changelog

## 0.19.2 - 2026-11-13

- Inside a thread `j`/`k` step through its messages (and scroll long ones); `g`/`G` jump to first/last message. Next/previous thread moved to `J`/`K`.

## 0.19.1 - 2026-11-13

- History opens on the **Open** tab (all unresolved threads, every page), so there is a chain to move through.
- Tabs are part of the Vim navigation: `k` from the first row focuses the tab bar, `h`/`l` switch tabs, `j` returns to the list.

## 0.19.0 - 2026-11-13

- Redesigned history/thread UI: tabs instead of a dropdown, compact rows (state, replies, links), slim thread header with Resolve and page link, link chips, chat-style messages with hover-only Edit/Delete, and a reply box pinned at the bottom.
- Vim triage in history: `j`/`k` move, `l` open, `r` resolve and advance, `h` back, `[`/`]` tabs, `i` reply, `o` open page. The status bar hint follows the level. Esc steps out (field, thread, panel).
- New demo clip `thread-triage`; `comment-links` clip uses the keys.

## 0.18.1 - 2026-11-13

- Demo recorder: `npm run demos` records feature clips (`docs/demos/public/*.webm`) with Playwright; `docs/demos/index.md` plays them. Needs `playwright-core` (dev) and Chromium.
- Fix: on pages without a prose body (`layout: page`, such as the graph) the keys `c`, `-h`, `-m`, `:` did nothing. They now work.
- Fix: the red "awaiting you" banners no longer cover the history or comment panel.

## 0.18.0 - 2026-11-13

- Links between comments. A thread shows `→` links to threads it references and `←` backlinks from threads that reference it; a picker ("Link to another thread…") adds a link, ✕ removes one. Following a link opens the target thread, switching page if needed.
- Agents link threads with `refs` on `add_doc_review_comment` and `link_comment_ids` on `update_doc_review_comment`.

## 0.17.3 - 2026-11-13

- A preview server older than the client no longer crashes it silently: a red bar says to reload extensions and restart.

## 0.17.2 - 2026-11-13

- History cards are tinted: red = waiting for you, amber = unresolved and not yet read by Copilot, blue = unresolved and read, dim = resolved.

## 0.17.1 - 2026-11-13

- `publish: false` front matter keeps a page out of `build:site` (page and tree.json). Preview still shows it.
- Clicking the quote of a video comment seeks the video to that time.

## 0.17.0 - 2026-11-13

- Videos in pages get a bar with frame-back, frame-forward, the current time and "Comment at this time". The comment quote reads `Video clip.mp4 @ 0:12.48` and marks the video.

## 0.16.4 - 2026-11-13

- Resolving a thread closes it and returns to the thread list.

## 0.16.3 - 2026-11-13

- The "new reply" pill opens the thread itself, not the history list.
- The status bar shows a short hint of the keys that matter right now (select, comment, threads, commands).

## 0.16.2 - 2026-11-13

- DocGraph scrolling: zoom-out stops at half the fit level, a swipe pans only while some content stays in view, and at either limit the gesture falls through so the page scrolls.

## 0.16.1 - 2026-11-13

- Agent threads about the whole page or the session show as a red banner at the top; clicking opens the thread.
- The "new reply" pill opens History directly. The toolbar loses its Page and Chat buttons (use `c` with nothing selected, `-m` or `:chat`).

## 0.16.0 - 2026-11-13

- Vim mode now shows as a status bar at the bottom (`-- NORMAL --`, with the agent status beside it); the toolbar button is just `Vim`.
- Attention markers: open threads the agent started whose last message is from the agent (not plain replies to your comments) count as awaiting you. The tab title gets `(n)`, and the page tree (breadcrumb, child list, popover, Tree button) shows red counts per page. Session chat counts in the total.

## 0.15.0 - 2026-11-13

- Agent status line: the `set_doc_review_status` tool shows "Copilot · reading: …" in the browser (cleared with state `idle`).
- Proposed-edit cards: `add_doc_review_comment` accepts `proposal: {before, after}`, shown as a diff with Accept/Reject. Accept replies "✓ Accepted" (wakes the agent, which applies the edit); Reject replies and resolves.

## 0.14.0 - 2026-11-13

- Page-level `:` command line (bottom bar, Vim mode): `:help`/`:man`, `:history`, `:chat`, `:comment`, `:tree`, `:keys`, `:vim on|off`. Esc cancels. The graph keeps its own `:` line when active.

## 0.13.0 - 2026-11-13

- Three comment scopes in one thread store: element (selection), page (`c` with nothing selected, or the `Page` button) and session chat (`-m`, or the `Chat` button). New kinds `page` and `session`; agents can start them with `add_doc_review_comment`. History gains a "Page & chat · open" filter, and session threads show on every page.

## 0.12.0 - 2026-11-13

- Resizable panels: in Vim mode, Alt+h/l narrow/widen and Alt+j/k shorten/heighten the open comment panel, history or bubble popover (mirrors Alt+hjkl split resizing in Neovim). Sizes persist in the browser.
- Key bindings now come from `scripts/preview_comments/keymap.json` rather than the client code. Override any entry in `~/.config/agent-doc-review/keymap.json` (or `$ADR_KEYMAP`); files deep-merge and apply on page reload. The graph (`DocGraph`) and tree (`t`) keys are not configurable yet.

## 0.11.1 - 2026-11-13

- Comment panel, history and bubble popover are wider (540 / 720 / 480 px), so long comments read comfortably.

## 0.11.0 - 2026-11-13

- Page tree: front matter `parent: <slug>` and `order: <n>` (with `nav:` for the label) build a hierarchy. Only pages without a parent stay in the top bar; every page with a place in the tree shows a breadcrumb, its child pages and a `☰ Tree` popover. Vim: `t` opens the tree, `j/k` move, `h/l` fold, Enter opens, `t`/Esc close (page layer only).
- `/tree.json` (preview and static build) lists the nested structure for agents.
- The example site nests Review and Graph under Home.

## 0.10.0 - 2026-11-13

- Agent-authored comments: the new `add_doc_review_comment` tool (`add_preview_comment` in the standalone extension) starts a thread on a text passage, equation, figure, graph node or edge. It is red, authored by Copilot, quiet for the agent, and the user's reply continues the thread. Commented equations get a red ring.
- Commented equations now get a marker and gutter tick too, for user comments as well.

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
