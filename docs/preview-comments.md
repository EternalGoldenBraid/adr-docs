# Comments on a local preview

The comment overlay saves feedback from a VitePress page in the current
Copilot session's inbox. It uses browser JavaScript and a session-scoped Copilot
extension; the overlay and bridge require no annotation service or additional
npm packages beyond the renderer.

The packaged plugin's setup and tool names are in the [README](../README.md).
The manual adapter below is for an existing VitePress server; its tools are
`get_preview_comments` and `update_preview_comment`. The packaged plugin uses
`read_doc_review_comments` and `update_doc_review_comment` so both adapters can
coexist.

Select text and click **Comment**, or click **Comment** first and then select
text or click an equation or figure. Write the note and press **Send**.
The overlay reports **Saved · awaiting review**. Replies and comment status
appear in **History**; document edits appear through the existing hot preview.

## Comment history and replies

**History** lists this session's saved comments as compact rows, with tabs
**This page**, **Page history** (every thread on this page, resolved ones included), **Chat**, **Open**, **All** and **Resolved**. Open a thread to see
its selected content, page link, link chips and dated replies from you and
Copilot; the reply box stays at the bottom.

A resolved thread stays closed, with its bubble hidden, until Copilot replies *after* it was resolved; it then returns to the open tabs, marked "new reply", until you open it (or press `r` on it). A sign-off sent together with the resolution does not count.

Tab shortcuts in the list: `A` All, `P` This page, `O` Open, `C` Chat, `R` Resolved, `N` Notes, and `P` then `A` (either order) for Page history.

Keyboard triage: in the list `j`/`k` move, `l` or Enter opens, `r` resolves the
row and moves to the next, `[`/`]` (or `k` from the first row, then `h`/`l`) switch tabs, `g`/`G` jump to the ends. In a
thread `j`/`k` step through the messages (and scroll), `J`/`K` go to the next or previous thread, `r` resolves (back to the list
on the next thread), `i` focuses the reply box, `o` opens the page (also on a focused thread in the list), `s` attaches
a region, `n` starts a linked child thread from the selected text (or the focused message), `h` goes back. `Esc` leaves a text field, then the thread, then closes
the panel. `:help` (or `:man`) lists these in a tabbed panel: Page, History, Text fields, Search & commands; `[`/`]` switch tabs.

**Vim in text fields** (with vim keys on): a field starts in insert mode; `Esc` or `jk` (typed quickly) enters normal mode (orange border, the cursor is a highlighted character), and `Esc` or `jk` again leaves the field so `h`/`l` pick the To: recipients (`i` returns). Normal mode: `h j k l`, `w b e`, `0 ^ $`, `gg G`; `i a I A o O` insert; `x dd D cc C`, `d`/`c`/`y` plus `w e b $ 0 ^ h l`, `yy`, `p P`, `u`, `Ctrl-r`. `v` / `V` start a visual selection (purple border; `o` swaps ends); `y`, `d`/`x`, `c` act on it, `Esc` returns to normal. No counts or `.` repeat.

**Resolve** and **Reopen** explicitly change the status. A reply keeps the
current status. Reading is separate: opening browser history does not mark
feedback read by Copilot, and an agent read receipt does not resolve a thread.
New comments start unresolved; older records retain their original read state
and start unresolved until explicitly reviewed.

Replies and status changes are persisted in the same append-only JSONL file
as the comments. The open panel refreshes every two seconds and has a
**Refresh** button. Refreshing, changing threads, and closing the panel preserve
unsent replies; opening history also preserves an unsent original comment.

Copilot calls `update_preview_comment` with a `comment_id` and a `reply`,
`resolved` boolean, or both. A combined reply and resolution is one durable
update. The optional `update_id` UUID can be reused for an unchanged retry.
User reply failures keep the draft and reuse its update ID on retry.

## Keyboard navigation and selection

Vim-style controls are enabled on document pages. A blue caret marks the
document position (only in caret mode); the **Vim** button shows **NORMAL**,
**CARET**, **VISUAL**, or **COMMENT** mode. Click it to turn keyboard controls off or on. The preference is saved for
the preview origin. The open history panel shows **HISTORY**. Textareas use
native input.

| Keys | Action |
| --- | --- |
| `j` / `k` | Normal mode: scroll the page smoothly (tap = small step, hold = continuous). Caret mode: move by rendered line. |
| `i` | Enter caret mode; `Esc` returns to normal mode. |
| `h` / `l`, `w` / `b`, `0` / `$` | Caret mode: move by character, word or rendered-line boundary. |
| `gg` / `G` | Scroll smoothly to the document start or end. |
| `L` / `H` | Move to the top or bottom of the visible document. |
| `v` | Enter visual selection; motions extend the selection. Press again to return to normal mode. |
| `V` | Select the whole paragraph (or list item, heading, table cell) under the caret and enter visual mode; `c` comments on it. |
| `c` in visual mode, or `-c` | Open a comment on the selection. `-c` also resumes an unsent draft. |
| `s` | Select a region and attach its screenshot (see below). |
| `-h` | Open comment history. |
| `:figure` | Or the **Figure** button: click a graph, inline SVG, image or canvas and it downloads as a figure file: graphs as a 4× PNG including node labels (theme background), SVG as SVG at 2×, images as is. `Esc` cancels. |
| `:help [section]` | Open the help, optionally at a section (`:help export`). |
| `:export` | Download this page as an offline file (also the **Export** button). One `.html`, or a `.zip` when media is over 2 MB; localhost iframes are replaced by a note; graph node images and videos are packaged too. `:export single` inlines everything into one `.html` (large); `:export compress` re-encodes videos with ffmpeg first (lossy, much smaller). The same as the CLI flags: `npm run export -- <file.md> --page /p --out deck.html --single [--compress]`. Progress shows in the status line. To export several pages, open the tree (`t`), press `v` (or **Select**) for select mode, tick pages (Space/`x`; `X` or **+ below** includes descendants; `a`/`A` all/none), press `e`: one `.zip`, an `.html` per page with working links between them. |
| `/` or `:grep [-d N] [-u N] [-s] [-p\|-c] <regex>` | Search the Markdown of the page tree and the comment threads (quote, comment, replies) on those pages; `-p` pages only, `-c` threads only; thread rows start with 💬 and `Enter` opens the thread. A list of `page:line` matches opens (`j`/`k` move, `Enter` opens the page and selects the match, `Esc` closes). No flag searches every page; `-d 0` only this page, `-d N` this page plus N levels below, `-u N` also N ancestors; `-1` means all levels (`-d 1 -u -1`: this page, its children and every ancestor). Smart-case like ripgrep unless `-s`. Unpublished pages are skipped; at most 200 matches. |
| `Space` inside a caveat | Open or close its details. |
| `Esc` | Leave visual mode or close a panel, preserving drafts. |

Agents can start threads too with `add_doc_review_comment` (page, kind, quote, comment). They appear red and signed Copilot; an equation is pointed at with `kind: equation, quote: "Equation (1)"` and gets a red ring. Your reply wakes the agent as usual.

## Page and session comments

`c` with nothing selected (or the `Page` button) comments on the whole page; `-m` (or `Chat`) sends a general message to the session that is not tied to a page. Both appear in History (filter "Page & chat") and are replied to like any thread.

## Agent status and proposed edits

The agent can show a status line (`set_doc_review_status`) and attach a before/after diff to a thread; Accept/Reject buttons reply to the agent, which then applies the edit itself.

## Command line

`:` opens a command line at the bottom of the page (Tab completes command names): `:help`, `:history`, `:chat`, `:comment`, `:tree`, `:keys`, `:vim on|off`.

## Resizing and key bindings

In Vim mode, Alt+h/l narrow/widen and Alt+j/k shorten/heighten the open panel, history or bubble popover; sizes persist. All page-layer bindings (motions, `v`, `c`, `s`, the `-` leader, resize keys and step) are defined in `scripts/preview_comments/keymap.json`. To customise, create `~/.config/agent-doc-review/keymap.json` (or point `ADR_KEYMAP` at a file) containing only the entries to change, e.g. `{"resize": {"wider": "A-L", "step": 60}}`; `A-`/`C-` prefixes mean Alt/Ctrl. Reload the page to apply.

## Addressing comments to specific agents

**Roster.** If the site has a team page (`team.md`, or the page named by `team-page:` in the root `index.md`) with a table whose header has `Who` and `Session` (optional `Role`, `Machine`, `Harness`), rows with a session id are the team and **To:** recipients, named by the slugged `Who` cell; the owner is the row whose session is this preview's. Addressed agents get a quiet mesh note naming the thread. In the composer, Esc leaves the text field and focuses the chips (`h`/`l`, Space; `i` returns, Esc closes). Put `<TeamGraph />` on the team page for a live table (replacing the roster table on screen) and graph grouped by an optional `Topic`, `Working on`, `Reports to` and `Machine` columns (views: Topic, Machine, Command); nodes show hook state and the agent's STATUS text, with a pulse travelling from sender to receiver for recent messages. The **Team** button in the history panel (or `:mesh`) shows their live status. The panel also shows each agent's latest `STATUS <ticket|-> | <running|idle|blocked|waiting> | <doing> | <next|->` mesh reply with its age, and who messaged whom in the last hour (counts only, no message text). A local agent's hook state (working/waiting/asking/idle) comes from the desktop's `agent-notify` files when present. Hover the small **Team** tab on the right edge to peek (it hides when you leave); `-m` pins or closes it.

By default a comment goes only to the agent that owns the preview. To address others, name your team once: `:owner alice` (this preview's agent), `:team bob carol`, `:default owner|last` (who is pre-selected: the owner, or the last recipients you used); `:settings` shows them. Settings are stored per preview, server-side.

With a team set, a **To:** chip row appears in the comment box, the history reply box and the thread popover. Click chips to toggle; at least one stays on. A reply keeps the thread's recipients unless you change them. Nothing is pushed: an agent only sees threads addressed to it, and only when it asks.

Agents read with `read_doc_review_comments` (`as`: its own name; `store`: the owning agent's session id when the preview isn't its own). The tool returns threads addressed to that name and marks them read for it only, independent of other recipients. `update_doc_review_comment` accepts `store` to reply in someone else's preview; `add_doc_review_comment` accepts `to`.

## DocGraph presentation mode

**▶ Present** (or `:present`) shows the graph full screen, one node at a time: title, body, image and link. Solid edges are the story and dashed edges lead deeper, so any graph can be presented. `→`/`←` (or `l`/`h`) move along the story, `↓`/`↑` (or `j`/`k`) go into and out of the dashed chain under the current node, `Enter` previews the node's link beside it and moves into it (the page's own Vim keys apply; `Esc` returns to the slide; a yellow border shows which side has focus), `o` opens the linked page, `c` (or selecting text) comments on the slide in view, anchored to its graph node, `gg`/`G` jump to the first and last step, and `Esc` exits. `:present` also works from the page command line, and `:help` has a Graph tab. A node's `video` (an mp4 path, like `image`) plays muted, looped and inline, with controls on hover; `image` is then its poster. A minimap shows your place; click a dot to jump.

## DocGraph node images and shapes

A node may carry `"image": "/public-path.png"` (or an http/data URL) and `"shape": "ellipse"` (also `rectangle`, `diamond`, `hexagon`, `octagon`, `barrel`, `round-tag`). The image is drawn inside the node above the title, scaled to fit the node's `w`/`h`; set those to size the box. Both survive edit mode, `:w` and export.

## Page tree

`.md` files at any depth are pages (a folder page defaults to that folder's `index` as parent). Front matter `parent: <slug>`, `order: <n>` and `nav: <label>` arrange them: only parentless pages stay in the top bar, and each page shows a breadcrumb, its child pages and a `☰ Tree` popover (Vim `t`; `j/k` move, `h/l` fold, Enter open). Red badges in the tree count threads that need you: ones the agent opened and awaits, and ones with an agent reply you have not yet seen. `/tree.json` lists the nested structure for agents, in the preview and the static build. A graph node `link` can point at the same slug.

### Classification banner

A thin fixed strip on every page, in the live preview, `npm run build:site` and offline exports. Set it once in the root `index.md` front matter; no other page can hide or change it:

```yaml
---
classification: "RESTRICTED · restricted-demo org only"
classification-level: restricted   # restricted (red) | internal (amber) | public (green)
---
```

If `classification-level` is omitted it is taken from the first word of the label, otherwise amber. Without `classification:` there is no banner.

Scroll gutter: unresolved comments appear as coloured ticks along the right edge, at their relative position in the page. Click a tick to scroll to it.

Key layers: the page owns the keys by default. Clicking a `<DocGraph>` enters the graph layer (status bar `-- GRAPH · NORMAL --`), where graph keys apply and page motions do not; `Esc` in graph normal mode returns to the page.

The leader is `-`. Word and line motions use the browser's text-selection
boundaries. Navigation stays inside the article; it does not edit the document.
Textareas and other form controls retain their native input behavior, as do
modified browser shortcuts. Mouse selection and equation/figure commenting
remain available. A browser without `Selection.modify` reports that keyboard
selection is unsupported.

In the tree popup: `j`/`k` move, `Enter` opens, `h`/`l` fold one row, `zc`/`zo` fold or unfold a row with everything below it, `H`/`L` collapse or expand all (also the **Collapse all** / **Expand all** buttons). Checkboxes appear only in select mode (`v`, **Select**; `Esc` leaves it and keeps the ticks).

Grouping: put `group-by: status` in an index page's front matter and its child pages that have a `status:` field appear under virtual group nodes (Active, Queued, Proposed, Blocked, Done, Declined; empty groups are hidden). Changing a page's `status` moves it; no `parent:` edits. Group nodes link to `#<status>` on the index page.

## Region screenshots

Press `s` in normal mode, drag a rectangle, and the crop opens a comment
with the image attached (up to four; **Region** in the panel adds more and
× removes one). With a history thread open, or a margin bubble's popover
showing, and no text box focused, `s` (or **Region**) attaches the crop to
that thread instead. `Esc` cancels the selection.

Capture uses the browser's screen capture (`getDisplayMedia`): choose **this
tab** in the one-time sharing prompt; later crops reuse it until sharing
stops. The overlay is hidden while the frame is taken. Crops are stored as
PNGs under `<session>/attachments/` and referenced from the comment
record; `get_preview_comments` returns each image's absolute path in
`imageFiles`, which the agent can open with its image viewer.

## Connecting a session

Use the extension authoring tools to scaffold a **session-scoped** extension.
Its `extension.mjs` imports this package's adapter:

```js
import { connectPreviewComments } from "/absolute/agent-doc-review/scripts/preview_comments/extension.mjs";

await connectPreviewComments({
  documentRoot: "/absolute/documentation/directory",
  previewOrigin: "http://127.0.0.1:8766",
  storageRoot: "/absolute/local-state/preview-comments",
});
```

Reload extensions. The extension logs its connection-file location, under
`storageRoot/<copilot-session-id>/connection.json`. This file contains an
ephemeral local access token; do not commit it or share it.

Add the plugin to the existing VitePress configuration:

```js
import { previewComments } from "/absolute/agent-doc-review/scripts/preview_comments/vite-plugin.mjs";

// Inside defineConfig({ ... }):
vite: {
  plugins: [previewComments({
    connectionFile: "/absolute/local-state/preview-comments/<copilot-session-id>/connection.json",
  })],
  server: { host: "127.0.0.1", port: 8766, strictPort: true },
},
```

Keep the existing VitePress options. The server must bind only to `127.0.0.1`;
the plugin proxies comments to the owning session's authenticated loopback
bridge. Both the page origin and recipient session are checked. No feedback is
uploaded to an external service.

## Persistence and failures

`comments.jsonl`, beside the connection file, stores each comment before
notification. Records include the document path,
source hash at submission, section/anchor, selected content and note.
Comments are snapshots: this version does not draw persistent markers
or re-anchor old notes after edits.

Notification failures preserve the saved comment and the open draft. Press
**Send** to retry; unchanged retries reuse the comment ID. Comments remain
unread until the agent explicitly calls `get_preview_comments`; the tool
persists a read receipt and returns unread feedback. Set `include_seen: true`
to include previously seen comments. Reading does not resolve a comment.
The JSONL file remains after the session ends. Legacy queue receipts are
accepted but do not count as read receipts.

## Attention without automatic reading

Comment and reply bodies are never sent as prompts. New user replies and
status changes make their thread unread again; Copilot's own replies do not
nudge it. While the assistant is processing,
a post-tool hook adds a count-only availability hint at the next successful
or failed tool boundary. The assistant can fetch the feedback or leave it
pending. An unchanged inbox does not repeat the hint.

When the assistant is idle, a count-only SDK `immediate` nudge wakes the same
conversation. The `assistant.idle` event also covers idle periods with running
background shells; it does not wait for session-wide idle or the prompt queue.
Each new inbox batch can produce another hint. Extension reloads can repeat
an availability hint, but never inject the stored comment bodies.

During migration, the adapter removes only pending legacy browser-comment
prompts whose IDs match saved queue receipts. Other queued messages and
commands are untouched.

Run the backend checks with Node.js:

```bash
node --test tests/preview_comments.test.mjs
```

The browser regression is `tests/preview_comments.browser.mjs`. Run it with
the Playwright MCP `browser_run_code_unsafe` tool's `filename` argument while
the local preview is open in the current browser tab. It uses that tab's origin,
opens a separate fixture tab,
checks keyboard and mouse commenting, history, resolution, and reply retries,
intercepts every comment and thread-update submission,
and restores the original tab and Vim preference.

## Video

Embed with `<video controls src="/x.mp4">` (files in `public/`, or a symlink under the doc root). Each video gets frame-step buttons and **Comment at this time**, which pauses and attaches a timestamped comment.

Click the quote of a video comment to jump to its time. Pages with `publish: false` front matter are left out of `npm run build:site`.

## Linking threads

Open a thread and use **Link to another thread…** to reference another thread. Links (`→`) and backlinks (`←`) are clickable and jump across pages. To branch a discussion, select text inside a thread's messages and press **↳ New thread**: the composer opens with that text as the quote, and the new thread is saved with a `→` link back to its parent. Agents pass `refs` when adding a thread or `link_comment_ids` when updating one.

## Next awaiting thread and notes

Which replies you have read is kept on the server, so every browser and port shows the same unread badges. If the plugin is updated while a preview is running, the status bar says `ADR x.y.z installed · restart preview`.


`]` / `[` (page level, vim mode) jump to the next / previous thread awaiting you, across pages. Highlights without text and private notes are not threads: they have no resolved state, stay off the Open/This page/Chat/Resolved tabs, and are listed on the **Notes** tab. Open one and press **Remove** to delete it; `r` never deletes.

## Landing on a link target

A link to `#anchor` scrolls the heading or passage clear of the nav bar and flashes it for 2 seconds. `/page#node-<id>` does the same for a graph node (opening its layer first). Reduced-motion preferences disable the animation.

## Rerun viewer

`<RerunViewer src="https://host/x.rrd" :height="560" />` embeds the hosted Rerun web viewer. Local files: put the `.rrd` in `public/` and use `src="/x.rrd"`. Comments attach to the page as usual; timestamp quoting is not implemented.

## Workstreams

Tickets in `workstreams/*.md` follow the schema in `workstreams/README.md`. The index page (`<WorkstreamBoard />`, built live from the front matter) groups them by status; `list_workstreams` (agent tool) or `npm run workstreams -- --json` returns them as JSON.

Within a status, tickets sort by `priority:` (lower first, unnumbered last); the queued group shows its rank. Owner chips (and `machine:` chips) on the board filter it. `<WorkstreamNow queued="3" />` puts a compact strip (all active tickets plus the next queued ones) on any page. To show the board in the top bar, give its index `parent: none` (an explicit top-level page) and a `nav:` label.

Links to `/workstreams/<id>` pages show a status chip (status, owner, progress) automatically.

With a team configured, the **To:** recipients in a comment box form a grid; press `Esc` twice in the text box, then `h j k l` to move, `Space` to toggle. The box opens beside or above/below the commented element so it does not cover it when there is room.
