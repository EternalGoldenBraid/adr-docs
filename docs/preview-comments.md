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

**Unsent text is kept.** What you type in the comment box (per page) and in each thread's reply box is saved in the browser as you type, so a refresh or a server restart does not lose it. The last 30 drafts are kept for 3 days; sending clears the draft.

**History** lists this session's saved comments as compact rows, with tabs
**This page**, **Page history** (every thread on this page, resolved ones included), **Chat**, **Open**, **All** and **Resolved**. Open a thread to see
its selected content, page link, link chips and dated replies from you and
Copilot; the reply box stays at the bottom.

A resolved thread stays closed, with its bubble hidden, until Copilot replies *after* it was resolved; it then returns to the open tabs, marked "new reply", until you open it (or press `r` on it). A sign-off sent together with the resolution does not count.

The list has four tabs: `P` This page, `H` Page history, `O` Open and `R` Resolved. Open lists the threads you have not resolved yourself, so one you resolved drops out even when others still owe a vote.

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
| `:read [stop]` | Read the open thread (or the listed threads) aloud in a cloned voice; `p` in the history does the same, `Esc` stops. Each message also has a 🔊 button. While reading, a control bar shows ⏮ ⏯ ⏭ ⏹; keys `p` pause/resume, `<` `>` skip, `Esc` stop. |
| `:export` | Download this page as an offline file (also the **Export** button). One `.html`, or a `.zip` when media is over 2 MB; localhost iframes are replaced by a note; graph node images and videos are packaged too. `:export single` inlines everything into one `.html` (large); `:export compress` re-encodes videos with ffmpeg first (lossy, much smaller). The same as the CLI flags: `npm run export -- <file.md> --page /p --out deck.html --single [--compress]`. Progress shows in the status line. To export several pages, open the tree (`t`), press `v` (or **Select**) for select mode, tick pages (Space/`x`; `X` or **+ below** includes descendants; `a`/`A` all/none), press `e`: one `.zip`, an `.html` per page with working links between them. |
| `/` or `:grep [-d N] [-u N] [-s] [-p\|-c] <regex>` | Search the Markdown of the page tree and the comment threads (quote, comment, replies) on those pages; `-p` pages only, `-c` threads only; thread rows start with 💬 and `Enter` opens the thread. A list of `page:line` matches opens (`j`/`k` move, `Enter` opens the page and selects the match, `Esc` closes). No flag searches every page; `-d 0` only this page, `-d N` this page plus N levels below, `-u N` also N ancestors; `-1` means all levels (`-d 1 -u -1`: this page, its children and every ancestor). Smart-case like ripgrep unless `-s`. Unpublished pages are skipped; at most 200 matches. `:grep -m <words>` searches by meaning instead: page paragraphs and threads ranked by similarity (a small local CPU model via `uv`, `tools/embed.py`; the first search downloads ~100 MB, later ones take milliseconds; vectors are cached in `~/.local/state/agent-doc-review/embeddings.json`; nothing leaves the machine). |
| `Space` inside a caveat | Open or close its details. |
| `Esc` | Leave visual mode or close a panel, preserving drafts. |

Agents can start threads too with `add_doc_review_comment` (page, kind, quote, comment). They appear red and signed Copilot; an equation is pointed at with `kind: equation, quote: "Equation (1)"` and gets a red ring. Your reply wakes the agent as usual.

## Page and session comments

`c` with nothing selected (or the `Page` button) comments on the whole page; `-m` (or `Chat`) sends a general message to the session that is not tied to a page. Both appear in History (filter "Page & chat") and are replied to like any thread.

## Agent status and proposed edits

The agent can show a status line (`set_doc_review_status`) and attach a before/after diff to a thread; Accept/Reject buttons reply to the agent, which then applies the edit itself.

## Command line

`:order newest` shows a thread newest reply first with the reply box on top (`:order oldest` restores the default). `j`/`k` and `g`/`G` follow what is on screen. The panel is also lean by default: tabs share the header row and the thread header starts with the page path.

`:calm` silences ADR on the current page (`:calm site` for all pages, `:calm off` to restore): no shortcuts, comment popups, screenshots or marks, only `:` stays. For pages with their own controls.

`:` opens a command line at the bottom of the page (Tab completes command names): `:help`, `:history`, `:threads`, `:chat`, `:comment`, `:tree`, `:new`, `:keys`, `:vim on|off`.

## Resizing and key bindings

In Vim mode, Alt+h/l narrow/widen and Alt+j/k shorten/heighten the open panel, history or bubble popover; sizes persist. All page-layer bindings (motions, `v`, `c`, `s`, the `-` leader, resize keys and step) are defined in `scripts/preview_comments/keymap.json`. To customise, create `~/.config/agent-doc-review/keymap.json` (or point `ADR_KEYMAP` at a file) containing only the entries to change, e.g. `{"resize": {"wider": "A-L", "step": 60}}`; `A-`/`C-` prefixes mean Alt/Ctrl. Reload the page to apply.

## Addressing comments to specific agents

**Roster.** If the site has a team page (`team.md`, or the page named by `team-page:` in the root `index.md`) with a table whose header has `Who` and `Session` (optional `Role`, `Machine`, `Harness`), rows with a session id are the team and **To:** recipients, named by the slugged `Who` cell; the owner is the row whose session is this preview's. Addressed agents get a quiet mesh note naming the thread, whether the user or another agent started it or replied in it (the sender is not told of their own message). Agents address replies with `to` (and `whisper`) in `update_doc_review_comment`, the same as the user. In the composer, Esc leaves the text field and focuses the chips (`h`/`l`, Space; `i` returns, Esc closes). Put `<TeamGraph />` on the team page for a live table (replacing the roster table on screen) and graph grouped by an optional `Topic`, `Working on`, `Reports to` and `Machine` columns (views: Topic, Machine, Command); nodes show hook state and the agent's STATUS text, with a pulse travelling from sender to receiver for recent messages. The **Team** button in the history panel (or `:mesh`) shows their live status. The panel also shows each agent's latest `STATUS <ticket|-> | <running|idle|blocked|waiting> | <doing> | <next|->` mesh reply with its age, and who messaged whom in the last hour (counts only, no message text). A local agent's hook state (working/waiting/asking/idle) comes from the desktop's `agent-notify` files when present. Hover the small **Team** tab on the right edge to peek (it hides when you leave); `-m` pins or closes it.

By default a comment goes only to the agent that owns the preview. To address others, name your team once: `:owner alice` (this preview's agent), `:team bob carol`, `:default owner|last` (who is pre-selected: the owner, or the last recipients you used); `:settings` shows them. `:tts on|off` controls whether read-aloud starts the text-to-speech server itself when it is down (on by default; the first read then takes about a minute). Settings are stored per preview, server-side.

With a team set, a **To:** chip row appears in the comment box, the history reply box and the thread popover. Click chips to toggle; at least one stays on. A reply keeps the thread's recipients unless you change them. Nothing is pushed: an agent only sees threads addressed to it, and only when it asks. Each chip carries the agent's mesh status as an icon (hover for the detail and its current task): 🔨 working (busy, mid-task), ⏳ waiting, ❓ asking, 💤 idle, 👀 online with unknown state, 🌙 offline. Check it before sending an unrelated task to an agent that is busy. Refreshed every 15 s.

Agents read with `read_doc_review_comments` (`as`: its own name; `store`: the owning agent's session id when the preview isn't its own). The tool returns threads addressed to that name and marks them read for it only, independent of other recipients. `update_doc_review_comment` accepts `store` to reply in someone else's preview; `add_doc_review_comment` accepts `to`.

## DocGraph presentation mode

**▶ Present** (or `:present`) shows the graph full screen, one node at a time: title, body, image and link. Solid edges are the story and dashed edges lead deeper, so any graph can be presented. `→`/`←` (or `l`/`h`) move along the story, `↓`/`↑` (or `j`/`k`) go into and out of the dashed chain under the current node, `Enter` previews the node's link beside it and moves into it (the page's own Vim keys apply; `Esc` returns to the slide; a yellow border shows which side has focus), `o` opens the linked page, `c` (or selecting text) comments on the slide in view, anchored to its graph node, `gg`/`G` jump to the first and last step, and `Esc` exits. `:present` also works from the page command line, and `:help` has a Graph tab. A node's `video` (an mp4 path, like `image`) plays muted, looped and inline, with controls on hover; `image` is then its poster. A minimap shows your place; click a dot to jump.

## DocGraph node images and shapes

A node may carry `"image": "/public-path.png"` (or an http/data URL) and `"shape": "ellipse"` (also `rectangle`, `diamond`, `hexagon`, `octagon`, `barrel`, `round-tag`). The image is drawn inside the node above the title, scaled to fit the node's `w`/`h`; set those to size the box. Both survive edit mode, `:w` and export.

## Page tree

`.md` files at any depth are pages (a folder page defaults to that folder's `index` as parent). Front matter `parent: <slug>`, `order: <n>` and `nav: <label>` arrange them: only parentless pages stay in the top bar, and each page shows a breadcrumb, its child pages and a `☰ Tree` popover (Vim `t`; `j/k` move, `h/l` fold, Enter open, `o` or Ctrl/middle-click open in a new tab; Shift+L is taken by "expand all"). Red badges in the tree count threads that need you: ones the agent opened and awaits, and ones with an agent reply you have not yet seen. `/tree.json` lists the nested structure for agents, in the preview and the static build. A graph node `link` can point at the same slug.

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

## Search in the published site

`npm run build:site` adds VitePress's local search (`Ctrl+K` or `/` on the
built site). It is fuzzy and prefix-matching, so typos like "revew" still
find "review". The live preview keeps `/` for its own `:grep`.

## Member colours and icons

Each agent's name is shown with a colour and an animal icon derived from the
name alone, so it looks the same in chat threads, the Team table and the Team
graph, in every session. Your own messages stay plain.

## Full screen

`f` in the history panel (or the ⛶ button) toggles it full screen, with the
text spanning the page width; press it again to go back.

## Region screenshots

Press `s` in normal mode, drag a rectangle, and the crop opens a comment
with the image attached (up to four; **Region** in the panel adds more and
× removes one). With a history thread open, or a margin bubble's popover
showing, and no text box focused, `s` (or **Region**) attaches the crop to
that thread instead. `Esc` cancels the selection.

You can also drop or paste image files into the new-comment panel (they join
the draft) or into an open thread (they attach to it). Other formats are
re-encoded as PNG. The **×** on a thread's image deletes it from the thread;
the file stays in `attachments/`.

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
import { connectPreviewComments } from "/absolute/adr-docs/scripts/preview_comments/extension.mjs";

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
import { previewComments } from "/absolute/adr-docs/scripts/preview_comments/vite-plugin.mjs";

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

**Threads and the pages they led to.** A page that was written in answer to a thread says so in its front matter: `from: <thread id>` (the first 8 or more characters, or a list), and optionally `author: <name>`. No other step is needed. The thread then shows a `📄` link to the page, and the page's **This page** history lists its own threads under *Written on this page* and the threads it came from under *Led to this page*, with *Page by …* on top.

## Next awaiting thread and notes

Which replies you have read is kept on the server, so every browser and port shows the same unread badges. If the plugin is updated while a preview is running, the status bar says `ADR x.y.z installed · restart preview`.


`]` / `[` (page level, vim mode) jump to the next / previous thread awaiting you, across pages. Highlights without text and private notes are not threads: they have no resolved state, stay off the tabs. Open one from the page and press **Remove** to delete it; `r` never deletes.

## Landing on a link target

A link to `#anchor` scrolls the heading or passage clear of the nav bar and flashes it for 2 seconds. `/page#node-<id>` does the same for a graph node (opening its layer first). Reduced-motion preferences disable the animation.

## People and labels

`:me NAME` (stored in this browser; `:me off` clears it) puts your name on the comments and highlights you make from then on. A highlight with a name is painted in that person's own colour, and its bubble too, instead of the colour picked; the same name always gives the same colour and symbol, as for agents. Unnamed highlights keep the picked colour.

`:labels` downloads every comment as a JSON line (`adr-labels.jsonl`) for use as labelled examples: `id`, `page`, `quote`, `text`, `person`, `version` (hash of the page source when commented), `at`, `resolved` and `fix` (the last agent reply, if any). The same lines are at `/__preview_comments/labels` (header `X-Preview-Comment: 1`).

## Route map

`<RouteMap src="/data/routes.json" :height="560" />` draws a top-down map with switchable layers: **Routes** (the road centre lines), **Recordings** (each drive's true path, coloured by driver; click opens its `url`, for example the catalog's Rerun view) and **Datasets** (the same paths coloured by role: train, val, test). Drag pans, scroll zooms, hover names the line. The JSON, with world coordinates in metres:

```json
{ "image": "/data/ue5/mosaic.png", "size": [860, 860], "metersPerPixel": 0.465, "origin": [430, 430],
  "routes": [{ "id": "0", "name": "Training road", "seeds": [1, 2], "points": [[x, y], …] }],
  "recordings": [{ "id": "r1", "name": "…", "route": "0", "driver": "teacher|student", "role": "train|val|test", "url": "/catalog#r1", "points": [[x, y], …] }] }
```

A recording may carry `"frames": { "src": "/data/thumbs/r1/{n}.jpg", "count": 40 }`: hovering the path then shows the frame nearest the cursor along the drive (`{n}` runs from 0 to count − 1, spread evenly over the points), so thumbnails from a bag can be dragged through with the mouse.

Alternatively one strip per recording: `"thumbs": { "src": "/data/map/thumbs/r1.webp", "size": [w, h], "at": [i0, i1, …] }`, a horizontal strip of frames where frame k belongs to `points[at[k]]`; the frame whose point is nearest the cursor is shown.

Image up is world +x and image right is world −y (the Sim mosaic's convention); `origin` is the pixel of world (0, 0), default the image centre. `image` is optional. A real map library is not needed until GPS arrives. `examples/map.md` shows it with synthetic data.

## Rerun viewer

`<RerunViewer src="https://host/x.rrd" :height="560" />` embeds the hosted Rerun web viewer. Local files: put the `.rrd` in `public/` and use `src="/x.rrd"`. Comments attach to the page as usual; timestamp quoting is not implemented.

`<SplatViewer src="/data/splat/car0/car.ply" :height="480" />` embeds a Gaussian splat (`.ply`, `.splat`, `.spz` or `.ksplat`) you orbit with the mouse. The viewer ships with the plugin and loads only on pages that use it, so nothing comes from outside. Optional: `:position="[0,0,5]"`, `:target="[0,0,0]"`, `:up="[0,1,0]"` (set the up axis of your capture) and `rotate` for a slow turn. About 100k Gaussians are a few MB.

## Workstreams

Tickets in `workstreams/*.md` follow the schema in `workstreams/README.md`. The board is legacy: new work goes on page cards as tests (see Team queues), and nothing in ADR creates tickets. The index page (`<WorkstreamBoard />`, built live from the front matter) groups them by status; `list_workstreams` (agent tool) or `npm run workstreams -- --json` returns them as JSON.

Within a status, tickets sort by `priority:` (lower first, unnumbered last); the queued group shows its rank. Owner chips (and `machine:` chips) on the board filter it. `<WorkstreamNow queued="3" />` puts a compact strip (all active tickets plus the next queued ones) on any page. To show the board in the top bar, give its index `parent: none` (an explicit top-level page) and a `nav:` label.

Links to `/workstreams/<id>` pages show a status chip (status, owner, progress) automatically.

With a team configured, the **To:** recipients in a comment box form a grid; press `Esc` twice in the text box, then `h j k l` to move, `Space` to toggle. The box opens beside or above/below the commented element so it does not cover it when there is room.

## Viewed marks

Like a pull request's "viewed" state: a blue dot in the page tree, the breadcrumb and the "Pages below" row marks pages that changed, or are new, since you last left them. It sits beside the comment marks (red dot: something new for you; ring: open thread waiting on the agent), so one glance covers both kinds of change. A page counts as viewed when you navigate away from it or close the tab; on a first visit all existing pages count as viewed. The state is a hash of each page's source, kept in `<site>/.adr-data/viewed.json` (`GET`/`POST /viewed` on the comment server), so it belongs to the site, not the browser.


## What's new

The status bar shows `N changed · n` when pages changed since you last left them. Press `n` (or `:new`) for the list, newest first: `j`/`k` move, `s` sorts by name, `l` or Enter shows the changed lines of the page (added in green, removed struck through, with context), `j`/`k` there jump between changes, `l` opens the page, `h` goes back, `m` marks the page seen, `M` marks all seen, Esc closes. A row shows `💬 N` for the open threads about that page, and `t` opens the page with them listed. The copy you last saw is kept in `<site>/.adr-data/snapshots/`; pages that were already marked seen before this existed show no diff until you next leave them. Preview only; the published site has no server to keep this.

Pressing `l` on a page in the diff view (or Enter in the list) opens the page and makes the changed passages glow, the first one in gold and the others in lilac. `}` and `{` jump between them, and `Space` marks the current one read and moves on. `O` opens the page in a new tab, with the same glow.

## Replying to one message

In a thread, focus a message (`j`/`k`), optionally select a passage in it, and press `q`: the quote is added to the reply box as `>` lines. Press `q` again on another passage (or another message) and the next quote is appended, so you can write between the quotes and answer several passages in one reply, in the order you place them. A selection inside a table keeps its rows. The first quote also links the reply to that message. The reply is stored with a link to that message (`inReplyTo`), shows that quote above it, and carries the quotes as `>` lines so agents see them. Messages render `>` quotes and Markdown tables; the reply and comment boxes grow with the text, up to a maximum height. `u` on a reply jumps to the quoted message; clicking the quote does too.

## Read aloud (local only)

Comments can be spoken with F5-TTS, cloned from a short reference clip. Start the synthesis server with `node tools/tts.mjs start` (`stop`, `status`). It runs on a GPU host over ssh and is reached through a localhost tunnel. Settings: `ADR_TTS_HOST`, `ADR_TTS_GPU`, `ADR_TTS_VENV`, `ADR_TTS_REF` (reference wav), `ADR_TTS_PORT`, and `ADR_TTS_URL` for the bridge. Audio is cached in `<store>/speech`. The F5-TTS weights are CC-BY-NC: personal use only.


## Sorting and grouping tables

Content tables with more than two rows get a **Group by** selector above them. Click a header to sort by it (click again to reverse, a third time to clear); Shift+click adds further sort keys, shown as ▲1 ▲2. Numbers and ISO dates sort by value, other text naturally. Groups collapse by clicking their row. **Reset** clears both. The choice is remembered per page and table in the browser's local storage; the page content is unchanged.

## Whispers

Start a reply with `/w name text` (several names with commas, team names such as `sim-agent`) to whisper. Only the named agents are addressed and see it; when any other agent reads the thread, the whisper is left out, and they are not told it exists. You see it in the thread as 🤫 *whisper → name* in a dashed lilac box. Like any addressed reply, a whisper makes the named agents the thread's recipients; address the next reply again to bring others back. Whispers work in comment threads, not yet in rooms.

## Rooms

The Team panel's **Room** tab (`-` then `m`) lists the rooms you are in. A room is a shared conversation among three or more mesh members, and its posts are visible only inside it, never as direct messages. **＋ New room** asks for a topic and members; agents can open one with `room_open`. Posting as you uses Ctrl+Enter. Rooms live in the mesh database, so any harness with the room tools sees the same room.

## Index toggle

The index (side columns: the sidebar and "On this page") is hidden so the page and its graphs use the full width. **+ Show index** under the top bar, or `\` outside text fields, shows it again (**− Hide index** hides it); the choice is remembered. Graphs open fitted; `+ - 0` zoom and `:fit` refits.

A page component can also start the region capture by dispatching a `preview-comment-region` event on `document`; use it for a button beside content whose text cannot be selected (iframes, canvases).

## Site dev-server plugins

`<site>/.vitepress/preview-plugins.mjs` may default-export an array of Vite plugins, or a function of the document root returning one. They load in the preview only (not in exports or the published site), so a page can use a site-defined endpoint, for example to start a local helper process. Restart the preview after adding the file.

## Region outlines

A thread started with a region screenshot (`s`) keeps the drawn area: the page shows an unfilled rectangle in the thread's colour with its bubble on the corner. The area is stored relative to the element it was drawn over, so it moves with the layout. Screenshots added to an existing thread, and threads from before 0.81.0, have no rectangle.

## Queued send

Every comment and reply waits in the agent's queue by default: it is saved and addressed as usual, but nothing wakes or messages the agent while it is busy. The hosting agent picks it up the next time it goes idle; an addressed mesh agent is messaged once its status is no longer "working". To interrupt instead, tick **⚠ interrupt** next to Send before sending (it unticks after each send), or press `Ctrl+Shift+Enter`. `Ctrl+Enter` follows the default.

`GET /__preview_comments/latency` returns, per thread and per addressed agent, how many minutes your messages waited for an answer and the median time to resolve, for the ceremony statistics.

## Served bundle (offline with runtime-fetched assets)

The normal export packages only what the page itself references: graph node images and videos, `src`/`poster` files and JSON data files named in the page source. Anything a component fetches or imports at run time (wasm, `.rrd` recordings, extra scripts) is not packaged, and `file://` blocks module and wasm loads anyway. For those sites:

```
npm run export -- site/index.md --serve --out talk.zip
```

The zip holds the whole built site (all of `public/` included) and `serve.py`. On the viewing machine: unzip, `python3 serve.py [port]`, and it opens `http://127.0.0.1:8000/`. Everything works as on the live site except the comment overlay and anything that needs a live server (for example a catalog server). `--page /x` (repeatable) builds only those pages. All of `public/` is included, so leave out unrelated large files with `--exclude 'data/v0/**'` (repeatable; globs relative to the site root).

## Editable tables

Under a table, leave a blank line and write `{editable}` (every column) or `{editable: Value, Notes}` (those columns only). On the live preview, double-click one of those cells, edit its markdown, and press Enter to write it into the page's source file (Esc cancels). Only the marked table and columns can be written, a `|` in the text is escaped for you, and ADR refuses a save if the file changed since you started editing. The marker line is not shown on the page. Exports are read-only.

### Published site: build badge and Publish

A site built in GitHub Actions can show a build badge and accept the same edits. In the site's `.vitepress/config.mjs` add `.use(editableTables)` to the markdown config (`src/editable-tables.mjs`) and `buildEnd: buildInfo` (`src/build-info.mjs`, which writes `build.json` with the commit, time and repository). The badge in the bottom-left corner shows the live commit and time, and "New version live, reload" when a later deploy appears.

Paste a fine-grained token for the repository (Contents: write, Actions: read) into the badge once; it stays in that browser. Then double-click a marked cell, edit, and Enter to queue the edit (the cell turns amber). Edits are not sent until you press **Publish** in the badge panel, which makes one commit to the branch (409 if the file changed on the branch since you started: discard and retry) and follows the build as Saved, Building, Deploying, Live or Failed. With a token the badge also shows builds started by anyone. One file can be queued at a time.

## Page cards

Give a page a fixed-size summary in its front matter:

```yaml
card-line: Interactive route map demo
card-status: building   # idea | planned | building | review | shipped
card-what: ...
card-state: ...
card-evidence: ...
card-next: ...
card-owner: ...
```

`<PageCard />` shows the card (put it at the top of the page); `<PageCard board />` lists every page with a `card-line`, grouped by status. Each slot is clipped to 120 characters (`budget="N"` changes it; the full text is in the tooltip), so cards are equally quick to read. The card is level 1, the line level 0, the page itself level 2.

### Past, present, future

`tense: past | present | future` in front matter (inherited from the parent page) separates history (experiment narratives), the current state, and plans: the page tree gets a grey, green or blue edge and the page a chip. A "present" page with `as-of: YYYY-MM-DD` older than `stale-days` (root index.md front matter, default 2 days) is flagged "may be stale". `card-status: superseded` counts as past; `card-superseded-by: /page` adds a banner linking to the page that replaced it.

The What's new list (`n`) previews the highlighted page (its card fields and first added lines) and remembers which page you opened last, so reopening it puts you back there.

### Participants

A page's participants are derived, not typed: `card-owner`, an optional `participants: a, b` list, `author:`, every agent that commented or replied on a thread about the page, and every name reported by a harness footprint. The thread panel shows them ("on this page: …"), and `/pagelinks` returns them as `participants` per page.

A harness records a footprint whenever its agent touches a page:

```bash
curl -s -X POST -H 'X-Preview-Comment: 1' -H 'Content-Type: application/json' \
  -d '{"path":"/experiments/2026-11-19-pc-fovea","agent":"pc-lead"}' \
  http://<name>.localhost:<port>/__preview_comments/touch
```

Footprints are stored in `<site>/.adr-data/touches.jsonl`.

### Needs verdict

A page with `card-status: shipped` (or `status: done`) must have a verdict and learnings: a structured front-matter `verdict:` block (below), and a `## Learnings`, `## What we learned` or `## Lessons` section or a `learnings:` field. Otherwise the tree and the card show an amber "needs verdict" chip and the board lists the page first.

### Tests on the card

One `card-test:` line per test: `card-test: Stage 1 | done | 2026-11-19` (status `planned`, `running`, `done` or `obsolete`; the date of the last update is optional). The card shows "1/3 done · 1 running", each test with ✓ ▶ ○ ✗, and the age of the newest update, in amber once it is older than `stale-days`.

The card also reads a nested `card:` block (`gist`, `state` = badge, `evidence`, `next`, `owner`, `tests: [{name, state, date, link, doer, rank, after}]`; `link: "#heading-slug"` turns the test's name into a link to its result; open tests show `queued #rank, doer` or `not queued: no doer`), and is placed under the page title automatically.

Test results: add `result: results/run-3.json` to a test (`{name: "…", state: running, result: results/run-3.json}`). The run script writes `{"status": "done", "finished_at": "2026-11-19T10:00:00Z"}` (status `running`, `done` or `failed`); ADR reads it and overrides the test's state and date. The page state is derived from the tests; the hand-written one is ignored when tests exist.

Mandatory card fields: gist (`card-line`), owner and state. Missing ones show as a red chip; `adr-check <site-root>` prints them and exits 1 (use it in a build or pre-commit hook to block).

Page owner: `owner: pc-lead` in a page's front matter fills the card's owner and makes that agent the default recipient of new threads on the page (a name that is not a known recipient is ignored). `participants:` lists extra recipients you can toggle on.

Team queues: put `queues.json` at the site root (`{"demo-agent": [{"rank": 2, "test": "…", "page": "…", "state": "planned", "run": ""}]}`). The team graph and table show each agent's running item, else the lowest rank; with an empty queue they fall back to the status ping. Items may carry `id` and `after` (ids of tests that must finish first, `id` or `page#id`); the team page then draws a task graph with one lane per agent and arrows for `after`. An agent listed with `[]` shows a "queue empty" chip.

An open thread's header shows where it sits in each addressee's queue (`queue sim-agent: #3 of 8`, from the `thread-<first 8 characters of the id>` item in `queues.json`), or a red `⚠ not in X's queue` while that agent still owes an answer. Answered, resolved and note threads show nothing.

```yaml
verdict:
  result: supported        # supported | not-supported | inconclusive
  claim: one line
  confidence: confirmed    # hypothesis | confirmed
```

Free text (`verdict: fine`) or a `## Verdict` heading no longer counts: writing the block is what unblocks done. A page that would be done without it stays in `review` with `blockedBy: [verdict]`.

`review` is the status between running and done: a finished page whose threads are still open. A page with `status: review` (or `card-status: review`) shows it. Threads opened on a page that is already done leave it done (a past page can be discussed again; `openThreads` counts them); keeping a page out of done while threads are open is the status generator's job, not the card's. A page in review never gets "needs verdict". A page with `voted: true|false` front matter also shows a "voted ✓" or "not voted" chip (the planning vote; blocking planned to running is the status generator's job). A card with no gist falls back to the page's `question:` front matter.

**Resolving with several people.** Your Resolve is one mark among the addressees': the thread closes when you and every addressee have resolved. The thread state shows a small pie (green = resolved, yellow = waiting) and "waiting on …". While others are still waiting the button reads **Close for all**, which is refused while any remaining agent is reachable and otherwise asks first, listing each one with its mesh state; it is for agents that are offline. Reopening clears everyone's mark. **Unresolve** takes back only your own mark while others are still open, and **Close for all** is a separate button. A new message that addresses someone who had resolved clears their mark and reopens the thread for them. Pasting or dropping an image on an open thread attaches it to the reply you are writing (up to 4); replies show their images and agents receive them as files. `threads.json` lists `unresolved_by` per thread, and the page card shows who has not resolved the open threads, so a queue generator can hold the page in each of their queues.

Typing `@` in a comment or reply opens a picker of team names (arrows, Tab or Enter to choose; Esc closes); the chosen agent is added to the To: chips, so `@sim-agent @gpu-agent please look` addresses both. A reply that starts `/w name[,name] text` is a whisper: while you type it the box turns purple with "🤫 Whisper: only … will get this" (or flags an unknown name).

Threads as work: where `queues.json` exists, ADR writes `threads.json` beside it, `[{id, page, addressees, answered_by, at}]` for every addressed thread not fully resolved (`answered_by` = addressees who replied since the user's last message or resolved), so the queue generator can list each unanswered addressee's thread. A thread with several addressees closes only when each has resolved it (an agent's resolve counts for itself); the user's Resolve closes it for everyone. An agent that has resolved no longer sees the thread as unanswered.

Idle nudge: an agent that is idle (agent-notify hook, or a status line `ticket|idle|…`) gets one mesh note naming one item, never while it is working and none that need a reply. Threads waiting on it (or needing its resolve vote) trigger it after 10 seconds idle, other queue items after 1 minute; at most one per 5 minutes. Threads come first, ordered by how likely the nudge is to close them (below); each note names the first item that has not been named at its current version (a thread's last reply or vote, a test's state or weight), so a stuck item does not hide the ones behind it. An item is named again only when its version changes, or after 30 minutes once everything has been named. A status line `waiting` posted since the last nudge counts as acting on it and pauses the nudge. Once the backlog has shrunk since the last nudge, the next follows as soon as the agent has been idle again for that wait. The team table shows "idle N min with K open". `ADR_NUDGE_MINUTES` sets the idle wait for queue items (default 1); turn off with `ADR_NUDGE=off`. Agents with neither hook nor status line are never seen as idle.

Ordering: every thread nudge is logged to `.adr-data/nudges.jsonl`. An agent's answer rate p is (answered+1)/(sent+2), answered meaning a reply on that thread within 30 minutes. A thread closes only when every missing addressee answers, so the thread named first is the one with the highest p·∏p(other missing addressees). It needs a few nudges before it differs from the arrival order.

`GET /itemturns` (local agents only) maps each queue item to the first interaction that named it, `told` (in the user message) or `acted` (in a tool call), and reports the unmapped share.

The verified state also carries `chain {n, hash}`, a digest of the last 8 event ids of the log, shown on hover in the Team panel; `verifyChain(lines, hash)` checks it against `events.jsonl`.

In the thread list, a reply you have not read shows a red dot, bold text and `NEW`. Resting on a card with j/k for 0.7 s marks it read.

**Bell**: the 🔔 button in the thread header (shown while someone has not resolved) sends a call for resolution right away to every addressee who has not resolved, naming the thread and page, and says who was rung and who is unreachable.

Unblock ping: every 30 s ADR checks which pages are held in review. When one leaves review for done (its last open thread resolved, its verdict written), the page owner gets one note: no blockers, check and set done. It never moves the page itself.

Queue events: ADR also reads `.queue-events.jsonl` at the site root (one JSON line per test state change: `at, page, test, state, by, owner, unblocks:[{id, doer}]`), polling every 30 s from the end of the file at startup. A test turning `done` sends each unblocked doer a hand-over note at once. A test turning `failed` or `lost` alerts its owner and the doers it blocks. Offline agents get nothing; `ADR_NUDGE=off` disables this too.

Effort votes: `adr-vote` writes `votes.json` (see the changelog, 0.115.0) and `<VoteHistory />` renders it with plots. Example: `adr-vote --root . /experiments/x A demo-agent 5`, then `adr-vote --root . --reveal /experiments/x A`.

## Agents on another machine

An agent on a peer machine (for example the GPU host) reaches a preview through the mesh, with no tunnel and no shared token. On that machine, install the plugin and write `~/.local/state/agent-doc-review/remote.json` as `{"machine": "my-laptop"}` (the peer that runs the previews). The usual tools (`read_doc_review_comments`, `update_doc_review_comment`, `unanswered_threads`, `add_doc_review_comment`, `set_doc_review_status`) then take `store: "demo"` for a store that machine does not run itself.

A named preview (`adr --name demo`) listens for `ADR-REQ` mesh messages (every 2 s; `ADR_MESH_SERVE=off` disables it). The caller finds the preview among the peer's agents by its directory name, sends the request, and the preview answers with `ADR-RES` messages, chunked to stay under the mesh's 10 KB limit. Only the agent endpoints are served (`/read`, `/unanswered`, `/agent-update`, `/agent-add`, `/agent-status`). Text only: images in replies are not carried yet.

## Threads about this page

`:threads` opens the history on **This page**: the threads started on the page, the threads of the page it was created from, and any thread whose text (comment or replies) links to the page by path, with or without `.html`. The What's new list (`n`) shows `💬 N` per page and `t` opens that page with the list. Read-only; it never edits links.

Room feed: `<RoomFeed />` lists every mesh room read-only (topic, members, open time, pinned summary, last 20 posts), refreshed every 15 s, from the bridge route `GET /rooms`. Viewing marks nothing read. A post starting `SUMMARY:` is pinned (latest wins); a post starting `CLOSED:` closes the room. Closed rooms stay behind a toggle.

Ceremony rows: `<CeremonyRows />` renders `ceremony.json` (site root, written by the site manager): `{date, closes, rows:[{ticket, page, planned, observed, owner, note, positions:{name:{vote:"agree"|"challenge", line, at}}, voters?}]}`, one row per ticket, read-only, refreshed every 15 s. `voters` defaults to the names in `positions`. A row is settled when every voter agreed.

### Verified state (Shift+T)

`Shift+T` (or `:mesh`, or the leader key then `m`) opens and closes the Team panel.

The Team panel shows two columns per agent. **Verified** is derived from the session's own `events.jsonl`: working (and the running tool), asking (a permission prompt is open), idle, or stalled (an open turn silent for 10 minutes). Hover for the last event's id and time. **Claim** is the agent's own `STATUS` line; a `≠` means it contradicts the log. Peer machines are read over ssh.

The Verified column also lists, after `→`, the queue items named in the agent's current interaction (by id, found in its prompt and tool arguments). `→ unattributed` means it is working but no queue item is named; it is never guessed.

### Moving and resizing panels

Drag a panel by its header (the comment panel by its top strip); the position is remembered per panel, and double-clicking the header resets it. In vim mode the open panel, including the Team panel, resizes with the `:keys` resize keys (Alt+h/j/k/l by default).
