# Changelog

## 0.67.0 - 2026-11-17

- A standalone server keeps its data with the site: comments, settings, images and audio live in `<site>/.adr/` (self-ignoring via `.adr/.gitignore`), so they follow the folder instead of a session id. A store that lived in `~/.local/state/agent-doc-review/<id>/` is moved there on the next start; runtime files (connection, exit log) stay in the state directory.
- Agent tools (`store`) accept a server name, e.g. `store="demo"`, or the site directory, as well as the store id; mesh notes now name the server.

## 0.66.0 - 2026-11-17

- Persistent servers: `adr keep <dir> --port N --name NAME` marks a server as kept; `adr daemon` (install it once with `adr daemon install`, a systemd user unit) starts every kept server at login and restarts it within 10 s if it is down; `adr unkeep` and the TUI's `x` stop keeping it. No agent has to own or restart the site.
- Wake-on-demand: when an agent tool (`read_doc_review_comments`, `update_doc_review_comment`, ...) targets a kept store whose server is down, the server is started and the call retried.
- `adr list` marks kept servers; `list_doc_review_servers` rows carry `kept`.

## 0.65.1 - 2026-11-17

- Docs and tool description: agents that need a lasting server should start it with `adr . -d --name <name> --store <session id>` (watchdog, exit log) rather than `start_doc_review`.

## 0.65.0 - 2026-11-17

- Server exit log: every stop is recorded with its reason (signal, uncaught exception, agent process exit) in `<store>/exit.json` and `~/.local/state/agent-doc-review/<store>.log`.
- Watchdog: servers started with `adr -d` (or the TUI) now run under a supervisor that restarts them on the same port and store if they die without a clean stop (gives up after 5 deaths in 2 minutes). A server attached to an agent session (`start_doc_review`) still ends with that session.
- `list_doc_review_servers` returns `{running, recentlyStopped}` with the exit reasons of the last 48 h.

## 0.64.0 - 2026-11-16

- `:grep -m <words>` is a semantic search over page paragraphs and comment threads, run locally on CPU (bge-small through an isolated `uv run --with fastembed` worker, started on demand and stopped after 10 idle minutes). Embeddings are cached on disk.

## 0.63.8 - 2026-11-16

- Agent replies are named without an `as` argument: the tool sends its session id and the server looks the name up in the team roster, so threads show e.g. "demo" instead of "Copilot". Each agent needs the updated plugin (new session or extension reload).

## 0.63.7 - 2026-11-16

- Machine load strip says what it shows: a title (CPU load, last hour, 1-minute load average vs. cores), numbers like `73 load / 32 cores (2.3×)`, `mem 79 %`, `GPU util 47 % / 25 %`, a labelled "all cores busy" line and a −60 min … now axis (Team page). Hover a row for the busiest processes.

## 0.63.6 - 2026-11-16

- Machine load in the Team panel and on the Team page: one row per machine with a load/cores sparkline (red above 90%), memory and GPU use; hover for the busiest processes. Read from `~/.mesh/load.jsonl` (sampled every minute by the dotfiles timer), locally or over ssh for roster machines (the roster's machine name must be an ssh host). `/mesh` returns it as `machines`.

## 0.63.5 - 2026-11-16

- Messages you send show their recipients (`You → agent`). Replies now keep their own recipients.

## 0.63.4 - 2026-11-16

- Comment bodies render Markdown images `![alt](url)` inline (click to open full size).

## 0.63.3 - 2026-11-16

- Agent replies store their sender: `update_doc_review_comment` takes `as` (your agent name), saved as `from`. The thread shows it instead of "Copilot", and quote-reply addresses that agent.

## 0.63.2 - 2026-11-16

- Quote-reply (`q`) sets the To: recipients from the quoted message: your own message's recipients, or, for an agent's reply, whoever the message before it was addressed to (agent replies don't record which agent wrote them).

## 0.63.1 - 2026-11-16

- Comment bodies render Markdown links `[text](url)` (http(s) or site-relative) as clickable links that open in a new tab.

## 0.63.0 - 2026-11-16

- Reply to one message: `q` on a focused message (with an optional selected passage) links your reply to it. The reply shows the quote, `u` jumps back, agents receive the quote.
- Read aloud has a visible control bar (⏮ ⏯ ⏭ ⏹) with Vim keys: `p` pause/resume, `<` `>` skip, `Esc` stop.

## 0.62.0 - 2026-11-16

- Read aloud: 🔊 on each message, `:read [stop]`, and `p` in the history read comments in a cloned voice (F5-TTS on a GPU host, localhost only). `node tools/tts.mjs start|stop|status` manages the server. Audio is cached per text.

## 0.61.1 - 2026-11-16

- `:help` has an **Export** section (`:export`, `single`, `compress`, multi-page, CLI), and `:help export` opens a section by name.
- Fixed: since 0.59.1 `:help` drew its tabs into the Team panel's tab row, so the help tab bar was missing and the Table/Graph buttons were replaced.

## 0.61.0 - 2026-11-16

- `:export single` downloads one self-contained `.html` (everything inlined); `:export compress` does the same with videos re-encoded smaller (ffmpeg, lossy). Same as the CLI `--single` / `--compress`. Plain `:export` is unchanged.

## 0.60.2 - 2026-11-16

- Thread messages render inline Markdown: `**bold**`, `*italic*` and `` `code` ``. Built from DOM nodes, so HTML in a message stays text. Editing still shows the raw text.

## 0.60.1 - 2026-11-16

- The history panel opens on **This page** instead of **Open**.

## 0.60.0 - 2026-11-16

- `<TeamGraph />` is redrawn in the peek's style (SVG): animated status indicators, grouped boxes for Topic and Machine, and the reports-to tree for Command. Messages are no longer arrows: a pulse travels from sender to receiver with a ripple at the receiver, so direction reads from motion. Cytoscape is no longer used by the Team page.

## 0.59.2 - 2026-11-16

- `<TeamGraph />` now also shows the live team table (Who, Status with the shared indicators, Doing, Machine) under the graph and hides the hand-written roster table. The markdown table stays as the roster source.

## 0.59.1 - 2026-11-16

- Team peek has **Table** and **Graph** tabs (choice remembered); the graph is a live SVG.
- Status indicators match the desktop panel: working = blue with spinning arc, waiting = pink pulse, asking = yellow pulse, idle = green, active = hollow ring, offline = dim ring. Same palette in the Team page graph, plus a legend.

## 0.59.0 - 2026-11-16

- TeamGraph: node colour now reflects hook state and STATUS (orange waiting/asking, red blocked), the label's second line is the agent's own STATUS "doing" text, and dashed lines show who messaged whom in the last hour (thicker = more). Works in all three views.
- The team peek has a visible small **Team** tab on the right edge (hover to peek, `-m` to pin) instead of an invisible corner zone.

## 0.58.1 - 2026-11-16

- Team panel: shows each local agent's hook state (working / waiting / asking / idle) from the desktop's `agent-notify` files (`$XDG_RUNTIME_DIR/agent-notify/*.json`, matched by working directory; ignored when older than 12 h). Complements the `STATUS` text; absent files change nothing. Agreed with the .dotfiles agent. `/mesh` members gain `activity`.

## 0.58.0 - 2026-11-16

- Team panel: shows each agent's latest `STATUS <ticket> | <state> | <doing> | <next>` mesh reply with its age, and who messaged whom in the last hour (counts only; no message bodies except STATUS lines). Read from the existing mesh database, so no mesh API change was needed. `/__preview_comments/mesh` now also returns `statusLine` per member and `edges`.
- Hot-corner peek: hover the bottom-right corner for a quick team view (hides on leave); `-m` pins or closes it.

## 0.57.0 - 2026-11-16

- Export: `--single` writes one self-contained `.html` with all images and videos inlined (no zip, one page). `--single --compress` first re-encodes videos with ffmpeg (H.264, max 960 px wide, no audio, CRF 30; originals untouched), typically less than half the size. Without these flags the export is unchanged.

## 0.56.6 - 2026-11-16

- Offline exports: `:` on the page now opens the graph's command line (exports have no page command line), so `:present` works without clicking the graph first. The **▶ Present** button was already there.

## 0.56.5 - 2026-11-16

- Fix: exports now package graph node `image` and `video` files (from the built site or `public/`): small ones are inlined, large ones go to `media/` (the export becomes a zip). Previously they stayed absolute paths and 404'd offline. Missing files are reported as warnings.
- Presenter in an offline export: `Enter` no longer opens a blank preview for pages that are not part of the export; `o` follows links to pages exported together and says so otherwise.

## 0.56.4 - 2026-11-15

- Fix: the selection toolbar (Comment + colour dots) no longer appears over the presenter. Clicking ▶ Present focused the button, which offered the toolbar; offers are now suppressed while presenting (comment with `c` or by selecting text).

## 0.56.3 - 2026-11-15

- Fix: `Esc` in the presenter's link preview no longer closes the whole presentation. The browser consumes that `Esc` to leave fullscreen, and the presenter used to close with it; now it just leaves fullscreen and stays open (`Esc` on the slide still closes).

## 0.56.2 - 2026-11-15

- Fix: scrolling the presenter's link preview with `j` then `k` no longer jumps back to the slide; only `Esc` leaves the preview.

## 0.56.1 - 2026-11-15

- Presenter: `Enter` on a linked node opens the preview and moves focus into it, so the page's own Vim keys work there; `Esc` returns to the slide (`jk` was dropped in 0.56.2: it clashed with scrolling). The preview has a yellow border while it has focus.

## 0.56.0 - 2026-11-15

- `:` command line completes with Tab (Shift+Tab backwards): a unique prefix completes, several matches are listed and cycled.
- Recipient chips form a grid (columns follow the panel width); `h j k l` move between them in the comment box.
- The comment box is placed where it covers the least of the thing being commented on: below, above, right or left.

## 0.55.1 - 2026-11-15

- Presentation mode: a DocGraph node can have a `video` (mp4 path, resolved like `image`); it autoplays muted and looped, with controls on hover, and `image` becomes its poster. The key hint no longer hides under the status bar.

## 0.55.0 - 2026-11-15

- Comment while presenting: `c` (or the 💬 button) opens the comment box on the slide in view; selecting text with the mouse opens it with the selection quoted. Comments anchor to the graph node (`node-<id>`), so they reach the page's owner like any node comment. The presenter now fullscreens the whole page so the overlay stays visible.

## 0.54.1 - 2026-11-15

- Presentation mode uses Vim motions: `gg`/`G` replace Home/End (arrows stay as duplicates); `:present` works from the page command line; `:help` has a Graph tab.

## 0.54.0 - 2026-11-15

- DocGraph presentation mode: **▶ Present** / `:present` shows a graph full screen, one node at a time. `→ ←` follow the solid (story) edges, `↓ ↑` go into and out of dashed drill-down chains, `Enter` previews the node's link, `o` opens it, `Esc` exits; a minimap shows the position.

## 0.53.0 - 2026-11-15

- `:help` / `:man` open a tabbed help panel (Page, History, Text fields, Search & commands); `[`/`]` or `h`/`l` switch tabs, `Esc` closes.

## 0.52.0 - 2026-11-15

- History tab shortcuts (capitals, list view): `A` All, `P` This page, `O` Open, `C` Chat, `R` Resolved, `N` Notes; `P` then `A` (either order, within 0.8 s) opens Page history.

## 0.51.2 - 2026-11-15

- `add_doc_review_comment` and `set_doc_review_status` now work against a standalone `adr` server (they failed with "Tool execution failed"); both take an optional `store`, defaulting to your own session's server.
- Restart a standalone server after updating ADR: it keeps running the code it started with.

## 0.51.1 - 2026-11-15

- Fix: `read_doc_review_comments` and `update_doc_review_comment` called with no `store` from a session whose `adr` server runs standalone now use that session's own store (they failed with "Start a document preview first").
- Failures from a standalone server are returned as `Error: <cause>` text instead of the host's bare "Tool execution failed".
- A server started before 0.51 keeps its old code until restarted (`:restart` in the page, or `r` in `adr tui`).

## 0.51.0 - 2026-11-15

- New agent state `blocked` for `set_doc_review_status` ("stuck, need help"). It requires a reason (up to 120 characters) and stays until the agent sets another state. In the page it shows as a red "Copilot needs help" bar (even with vim off), a blinking red Comments dot, a ⛔ tab title and a desktop notification.
- Fix: `read_doc_review_comments` and `update_doc_review_comment` with `store` set to your own session now go to the standalone `adr` server instead of failing (an `adr` server has no preview inside the agent session). `as` is optional for your own store.
- Fix: `update_doc_review_comment` accepts the 8-character thread id shown in the UI and mesh notes, not only the full UUID.
- Mesh notifications quote up to 400 characters (was 100) and say when truncated.

## 0.50.0 - 2026-11-15

- `adr <folder> --name demo` names a server; open it as `http://demo.localhost:PORT` (any `NAME.localhost` reaches the same server, comments included). The port is still needed.
- `:restart` in the page restarts a server started with `adr` and reloads the page when it is back.
- `adr tui` lists recent servers (kept in `history.json`) as well as running ones; `r` restarts the selected server or starts a recent one again. `x` and `r` refuse servers hosted by an agent session, which must be stopped with `stop_doc_review`.

## 0.49.1 - 2026-11-15

- Fix: `i` (caret mode) no longer makes the page jump. The caret starts at the visible text nearest the middle of the screen, and an old selection that is off-screen is ignored.

## 0.49.0 - 2026-11-15

- `V` in the page vim modes selects the whole paragraph (or list item, heading, table cell) under the caret and enters visual mode, so `c` comments on it.

## 0.48.0 - 2026-11-15

- `adr <folder> -d` (`--detach`) starts the server in the background and prints its URL.
- `adr tui`: a dark terminal list of running servers; `j/k` move, `x` stops (with confirmation), `o` opens, `r` refreshes, `q` quits.
- New agent tool `list_doc_review_servers` returns the running servers and their comment stores.

## 0.47.0 - 2026-11-15

- `adr list` shows the running ADR servers (url, pid, store, folder) and removes stale entries. `connection.json` now records `pid`, `documentRoot` and `startedAt`.
- `adr` refuses ports that browsers block (e.g. 6666, 6665–6669), which looked like a dead server.

## 0.46.0 - 2026-11-15

- `adr <folder> --port N` serves a whole folder of pages from its `index.md`, so a site can be opened without an agent session. The port can also be given as before, as a second argument.
- The comment store of a folder can be pinned with a UUID in `<folder>/.adr-store`, or chosen with `--store UUID`, so the same threads open whether a person or an agent launches the site. The store is printed at startup.
- Launched this way, with no agent session hosting the preview, the store's owner agent is also told of comments over the agent mesh, including unaddressed ones. Agents that are offline find the comments on disk later.

## 0.45.0 - 2026-11-15

- New **Page history** tab in the thread list: every thread on the current page, resolved ones included, so an accidentally resolved thread can be found and reopened.

## 0.44.1 - 2026-11-15

- Fix: exporting a page ran `vite build` in the extension process and left `NODE_ENV=production` set, which broke the live preview ("404 PAGE NOT FOUND", `__VP_HASH_MAP__ is not defined`). The export now restores `NODE_ENV` afterwards.

## 0.44.0 - 2026-11-15

- Vim modes in comment and reply text fields: insert, normal (motions, `x dd D cc C`, `d/c/y` + motion, `yy p P`, `u`, `Ctrl-r`, `i a I A o O`) and visual (`v`, `V`). `Esc`/`jk` goes insert → normal → leaves the field.
- `n` in a thread starts a linked child thread from the selected text, or from the focused message when nothing is selected.

## 0.43.0 - 2026-11-15

- `:figure` / **Figure** button saves a graph (4× PNG with node labels), inline SVG, image or canvas as a large figure file, for papers and slides instead of small screenshots. Equations and arbitrary page blocks are not covered yet.

## 0.42.0 - 2026-11-15

- Child threads: select text inside a thread's messages and press **↳ New thread** to start a new thread from that quote, linked (`→`) to its parent. The server now accepts `refs` on user comments.

## 0.41.1 - 2026-11-15

- `<WorkstreamNow />` rows no longer get a second status pill from the link decorator.

## 0.41.0 - 2026-11-15

- `jk` typed quickly in a comment text field (with vim keys on) acts as `Esc`, matching nvim configs that map it.
- Work board: `priority:` front matter orders tickets within a status (queued rows show their rank); `machine:` front matter; owner and machine filter chips; new `<WorkstreamNow queued="3" />` strip (active plus next queued) for any page. Docs say how to put a folder index in the top bar (`parent: none` + `nav:`).

## 0.40.2 - 2026-11-15

- Reading threads `as` a name that is not on the team page now fails with the list of valid names (for example `predictive-coding-lead`) instead of returning nothing.

## 0.40.1 - 2026-11-15

- Team graph Command view: tidy tree layout keeps each agent's reports under it; node labels show name and a truncated "Working on" line instead of the role.

## 0.40.0 - 2026-11-15

- `<TeamGraph />` has Topic, Machine and Command views (tab remembered): topic groups, machine groups with nested topics, and a top-down reports-to tree (humans shown without a status colour). Larger labels. The roster reads two new optional columns, `Topic` and `Reports to`.
- Wider reading column on doc pages (about 1040 px instead of 688 px) to cut the empty margins.

## 0.39.2 - 2026-11-15

- Team status shows why a peer machine could not be resolved (`errors` from `/mesh`, shown in the Team panel).

## 0.39.1 - 2026-11-15

- Team status now resolves roster agents on enrolled peer machines (the `Machine` column matching a `machines.json` peer) over the mesh's SSH route, so remote agents no longer show offline. Cached for 15 s.

## 0.39.0 - 2026-11-15

- `<TeamGraph />`: live team graph for the team page. One node per roster agent, coloured by mesh status (active / idle / offline), grouped into subgraphs by the roster's new `Working on` column. Needs a running preview.
- Composer: Esc leaves the comment field (draft kept) and focuses the **To:** chips; `h`/`l` move between chips, Space toggles, `i` returns to the text, Esc again closes.

## 0.38.0 - 2026-11-15

- DocGraph: self-loop edges (an edge whose source and target are the same node) draw as a loop; an optional `loop` field (`left` default, `top`, `right`, `bottom`) picks the side. Compact nodes (any kind other than `node`) show their body as hover text.

## 0.37.1 - 2026-11-15

- Team panel: a **Team** button in the comment history (and `:mesh`) opens a live table of roster members with status, machine, harness and session.

## 0.37.0 - 2026-11-15

- The team page is the roster: a Markdown table with `Who`, `Session` and optional `Role`, `Machine`, `Harness` columns (page named by `team-page:` in the root `index.md`, default `team.md`). Rows with a session id become the **To:** recipients and the owner is the row matching this preview's session; `:team`/`:owner` remain the fallback.
- Addressed agents get one quiet (normal priority) mesh note pointing at the thread; they pull it when they choose. Needs the mesh with quiet delivery.
- `:mesh` shows the roster members' live mesh status, machine and harness.

## 0.36.0 - 2026-11-15

- Address comments to specific agents: `to` recipients with **To:** chips, `:owner`/`:team`/`:default`/`:settings`, per-agent read state, and `as`/`store` on the agent tools so other agents read and reply to threads addressed to them. Pull-based: nothing is pushed to agents.

## 0.35.1 - 2026-11-15

- Page tree: a folded row shows a `↓n` badge for threads needing you on the pages hidden below it.

## 0.35.0 - 2026-11-14

- DocGraph: optional node `image` (shown inside the node) and `shape` (ellipse, rectangle, diamond, ...).

## 0.34.0 - 2026-11-14

- Page tree: `group-by: status` in an index page's front matter groups its child tickets under virtual status nodes, driven by each ticket's `status:`.

## 0.33.0 - 2026-11-14

- Page tree: export checkboxes and the Export bar appear only in select mode (`v` or the **Select** button; `Esc` leaves it, ticks are kept; `a`/`A` tick all/none). New folds: `zc`/`zo` fold or unfold a row and everything below it, `H`/`L` collapse or expand all, plus **Collapse all** / **Expand all** buttons.

## 0.32.1 - 2026-11-14

- The page tree popup scrolls to keep the Vim cursor row in view (`j`/`k` past the visible rows, and on open).

## 0.32.0 - 2026-11-14

- Seen state is stored on the server (`userseen` log events, `userSeen` on each thread), so unread badges, the Tree counts and the `]` beacon agree across browsers, ports and cleared storage. The first browser to meet an existing store uploads what it already knew; browser storage stays as a fallback.
- The status bar warns when the installed plugin is newer than the running preview ("ADR 0.32.0 installed · restart preview"; `/__adr/version`).
- `<WorkstreamBoard />` renders the workstreams board live from the ticket front matter (grouped by status, with owner, steps, dependencies, summary); `workstreams/index.md` is now that one component, and `npm run workstreams` just writes that page. Ticket data in the theme config also carries title, summary, date and dependencies.

## 0.31.0 - 2026-11-14

- GFM task lists: `- [ ]` and `- [x]` render as read-only checkboxes in the live preview, the built site and exports. Projects with their own VitePress config add `md.use(taskLists)` (`import taskLists from "<adr>/src/task-lists.mjs"`) and import `<adr>/src/theme/task-lists.css` (the ADR theme already does).

## 0.30.0 - 2026-11-14

- `:grep` also searches comment threads (text, quote and replies) within the same page scope; Enter opens the thread. `-p` searches pages only, `-c` threads only.

## 0.29.0 - 2026-11-14

- Search: `/` or `:grep [-d N] [-u N] [-s] <regex>` greps the Markdown of the page tree and lists file:line matches (j/k, Enter opens the page and selects the match). No flag searches every page; `-d 0` this page, `-d N` this page plus N levels below, `-u N` also N ancestors; `-1` means all levels; smart-case unless `-s`. Unpublished pages are skipped; results are capped at 200.

## 0.28.2 - 2026-11-14

- Tree, breadcrumb and "Pages below" badges take the colour of the most recently active thread they count, instead of always red. Marking a thread seen updates the badges at once.

## 0.28.1 - 2026-11-14

- The page tree, breadcrumbs, tab title and `]`/`[` jump now also flag pages with threads that have an agent reply you have not seen (on threads you started too), not only threads the agent opened. Resolved threads count only for replies sent after resolving.

## 0.28.0 - 2026-11-14

- Classification banner: `classification:` and `classification-level:` (restricted / internal / public) in the root `index.md` front matter show a thin fixed strip on every page, in the preview, the static build and offline exports. Requested via the demo agent.

## 0.27.4 - 2026-11-14

- Comment history: `o` on a focused thread in the list jumps straight to its page (previously only inside an open thread).
- Region capture (`s`) no longer hides the overlay when the history, comment box or thread popup is open, so the history view can be screenshotted (it used to come out as an empty rectangle).

## 0.27.3 - 2026-11-14

- Resolved threads come back when Copilot replies after they were resolved: they reappear in the open lists, count as a new reply and get their bubble back on the page. A sign-off sent together with the resolution does not count, so resolved threads no longer pile up as unread. (Replaces the 0.27.2 rule that hid them regardless.)

## 0.27.2 - 2026-11-14

- Resolved threads no longer stay in the Open/This page/Chat lists or count as unread when Copilot replies after they were resolved; only unresolved threads (or ones awaiting you) stay visible. They remain under Resolved.

## 0.27.1 - 2026-11-14

- Export picker: ticking a page selects only that page. Each parent row has a **+ below** button (and `X`) to tick or clear it together with all its descendants.
- Links between pages in a multi-page export now work offline; links to pages that were not exported stay inert.

## 0.27.0 - 2026-11-14

- Export several pages at once: open the tree (`t`), tick pages with Space or `x` (ticking a page also ticks the pages below it, or click the checkboxes), then press `e` or **Export N selected**. Several pages give one `.zip` with an `.html` per page; links between exported pages stay inert.
- Export now shows a progress bar (`Exporting ██████░░░░ 3/5 Packaging /a`) driven by a server-side job, so a long build no longer looks stalled. The CLI prints the same steps and accepts repeated `--page`.

## 0.26.0 - 2026-11-14

- DocGraph: edges meeting the same side of a node now attach at separate points, ordered by where the other end lies so lines do not cross; opposite-direction edges between the same pair run side by side. Solid and dashed edges alike. Elbows are drawn as explicit segments, so corners are square (the old rounded taxi corners are gone). Requested via the demo agent.

## 0.25.1 - 2026-11-14

- Export: dead links to pages outside the single-page build no longer abort it (`ignoreDeadLinks`); the document may be the page's own file or any file in the site (the site root is found by climbing to where the page path resolves); a missing page now says which file to pass.

## 0.25.0 - 2026-11-14

- Offline export of a page: **Export** button (also `:export`) in the preview, or `npm run export -- <file.md> [--page /path] [--out file] [--zip] [--inline-media-under <MB>]`. Works without a Copilot session. Produces one self-contained `.html` (script, styles, fonts, images, graph JSON inlined; opens from `file://` with an interactive DocGraph and no comment UI), or a `.zip` with `media/` when the page has media over 2 MB. Localhost iframes become a placeholder and are reported as warnings; links to other pages are inert. Only the exported page is built, so broken front matter elsewhere cannot block it.

## 0.24.0 - 2026-11-14

- `adr <file.md> [port]`: standalone launcher (package `bin`), no Copilot session needed. Each document gets its own stable comment store instead of one shared placeholder session. Install with `ln -s <repo>/bin/preview.mjs ~/.local/bin/adr` (or `npm link` where the global prefix is writable). Validates the file and port.

## 0.23.1 - 2026-11-14

- `update_doc_review_comment` accepts an optional `proposal` (`before`/`after`): the diff card is posted as a reply inside the existing thread, with its own Accept/Reject. Several cards per thread work. Requested via the demo agent.

## 0.23.0 - 2026-11-14

- Vim normal mode scrolls the page smoothly: `j`/`k` tap or hold, `gg`/`G` animate. Line-by-line caret motion (`h/j/k/l/w/b/0/$`) now needs caret mode (`i`, status `CARET`, `Esc` to leave); the caret is shown only there. Graph layer unchanged. Requested via the demo agent.

## 0.22.3 - 2026-11-14

- Workstream tickets: optional `resume` front-matter field (in the JSON board) and `workstreams/template.md.example` as the ticket template (from the demo agent).

## 0.22.2 - 2026-11-14

- The page tree now includes Markdown files in sub-folders (slug = path, e.g. `docs/preview-comments`). A page in a folder defaults to that folder's `index` (else the root `index`) as its parent; `parent:` still overrides. Fixes the Tree popup and "Pages below" doing nothing on sites whose pages are not all top-level. Added a repo-root `index.md` hub.

## 0.22.1 - 2026-11-14

- Links to a workstream page (`/workstreams/<id>`) get a status chip after them (status, owner, steps done/total), coloured by status. Data comes from the `workstreams/` folder under the document root and refreshes with the page tree.

## 0.22.0 - 2026-11-14

- **Native workstreams:** one front-matter schema (`title`, `status` = proposed/queued/active/blocked/done/declined, `owner`, `requester`, `date`, `summary`, `depends_on`), checklist steps counted as progress, and a generated index grouped by status (owner, steps, dependency links). `npm run workstreams -- --json` and the new `list_workstreams` agent tool return the board as JSON. Legacy `accepted`/`in-progress` read as `queued`/`active`.

## 0.21.0 - 2026-11-14

- **`<RerunViewer src="…/x.rrd" :height="560" />`:** embeds the hosted Rerun web viewer (timeline and playback inside the page, dark theme). `src` is an absolute URL or a path served from `public/`; optional `version` (default `latest`). Example page: `examples/rerun.md`.

## 0.20.1 - 2026-11-14

- **Link landing highlight:** following a link to `#anchor` (also in-app and from comments) scrolls the target below the nav bar and flashes it for 2 s; `/graph#node-<id>` opens the node's layer, centres, selects and flashes it. Reduced-motion users get no animation.

## 0.20.0 - 2026-11-14

- **Next awaiting thread:** `]` / `[` on any page jump to the next / previous thread waiting for you, across pages (navigates, then opens the thread). Completes the attention beacon.
- **Notes tab:** bare highlights and private notes have no resolve state and no longer clutter triage. They are listed on a separate **Notes** tab (also under **All**), counted apart, and the thread view offers **Remove** instead of Resolve. A highlight's comment can still be deleted while keeping the highlight, and the highlight removed, from its popover.

## 0.19.4 - 2026-11-13

- Unseen Copilot replies are always surfaced: a resolved thread with a reply you have not seen is listed on the **Open**/**This page**/**Chat** tabs (badge "resolved · new reply") until you view it, so the "N new replies" pill and the history agree. `r` on such a row marks it seen without reopening it.

## 0.19.3 - 2026-11-13

- The sidebar, top bar and Tree popup follow the document root live: adding, removing or re-parenting a `.md` page (or changing `nav`/`order`/`parent`) reloads the VitePress config and server on the same port. No preview restart needed.

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
