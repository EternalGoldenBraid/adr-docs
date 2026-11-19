# Changelog

## 0.110.0 - 2026-11-19

- A test can name `result: path` (relative to the site root): a JSON file `{"status": "running|done|failed", "finished_at": "…"}` written by the run script. It overrides the test's hand-written state and date, so a crash shows as a red ✕ with no manual edit; those rows are marked "·run".
- The page state is derived from its tests (failed, running, done when none is open, else planned). A hand-written state that disagrees is kept as `statusMismatch`.

## 0.109.0 - 2026-11-19

- The card appears by itself directly under the page title (no `<PageCard />` needed) for every page that has one; a page that places `<PageCard />` itself keeps its own.
- The nested `card:` front matter (`gist`, `state`, `evidence`, `next`, `owner`, `tests: [{name, state, date}]`) is read as well as the flat `card-*` keys.
- Tests show as a list (✓ done, ◐ running, ○ planned, ✗ obsolete) with a count line and "last result N d ago", flagged stale when something is running and the newest result is older than `stale-days`.

## 0.108.0 - 2026-11-19

- The card lists its tests: repeated `card-test: name | status | date` lines show "n/m done", per-test marks and the age of the last update.
- The "may be stale" threshold is now `stale-days` in the root index.md (default 2, was 14), and also colours the card's update age.

## 0.107.1 - 2026-11-19

- In-page links `[text](#section)` now render as links in messages and the quote box (they showed as raw Markdown) and scroll within the page instead of opening a new tab.

## 0.107.0 - 2026-11-19

- "Needs verdict": a finished page (`card-status: shipped` or `status: done`) without non-empty "Verdict" and "Learnings" sections gets an amber chip in the page tree and on its card, and `<PageCard board />` lists those pages first.

## 0.106.0 - 2026-11-19

- Page participants, derived: `card-owner`, `participants:`, `author:`, agents who commented on threads about the page, and harness footprints. New `POST /__preview_comments/touch {path, agent}` lets a harness record that its agent touched a page; `/pagelinks` returns `participants`, and the thread panel shows them.

## 0.105.0 - 2026-11-19

- Links in a page that lead to a page changed (blue dot) or new (green dot) since your last visit get a dot, so an index page shows where the news is. It follows the same viewed state as the tree and What's new.

## 0.104.2 - 2026-11-19

- Links inside **bold** or *italic* in messages now render (`**[text](/path): done**` showed raw Markdown).

## 0.104.1 - 2026-11-19

- A thread's "Selected content" box now renders Markdown links and quotes (was raw `[text](/path)`), and the summary and reply-target lines show the link text only.

## 0.104.0 - 2026-11-19

- Package exports for site builds, so a site can `npm i github:EternalGoldenBraid/adr-docs` and import by name instead of through a symlink: `adr-docs/task-lists`, `/editable-tables`, `/build-info`, `/page-tree`, `/theme`.

## 0.103.1 - 2026-11-19

- Leak guard also rejects a commit whose author or committer identity matches the denylist, and pre-push scans author names and e-mails of the commits being pushed.

## 0.103.0 - 2026-11-19

- `tools/leak-guard.sh` with `.githooks/pre-commit` and `.githooks/pre-push`: block commits and pushes whose added lines or file names match a private denylist kept outside the repo (`~/.config/adr/denylist`, or `$ADR_DENYLIST`). Enable once per clone with `git config core.hooksPath .githooks`.

## 0.102.0 - 2026-11-19

- Renamed the package and plugin to `adr-docs` (repo `EternalGoldenBraid/adr-docs`); the history was rewritten to drop a company theme that should never have been in this repo. State, config and mesh names (`~/.local/state/agent-doc-review`, `~/.config/agent-doc-review`, `agent-doc-review-site`) are unchanged so existing sites and key maps keep working.

## 0.101.0 - 2026-11-19

- Removed the company (company) theme and the π/N theme picker from the package; branding stays local to the site that wants it. Earlier entries below still describe the removed feature.

## 0.100.0 - 2026-11-19

- What's new: the highlighted row shows a preview (the page's `card-line`, `card-state`, `card-next`, then its first added lines), and reopening the list (`n`) puts the cursor back on the page you last opened from it.

## 0.99.0 - 2026-11-19

- Past / present / future: `tense: past|present|future` in front matter (a page inherits its nearest ancestor's) colours the page tree (grey history, green now, blue plan) and shows a chip next to the breadcrumb. `as-of: YYYY-MM-DD` on a "present" page marks it "may be stale" after 14 days. `card-status: superseded` implies past, and `card-superseded-by: /page` adds a "Superseded by" banner on the card.

## 0.98.0 - 2026-11-19

- Page cards: a page's front matter can carry `card-line` (one line), `card-status` (idea / planned / building / shipped) and the slots `card-what`, `card-state`, `card-evidence`, `card-next`, `card-owner`. `<PageCard />` renders the card (every slot clipped to the same 120-character budget), `<PageCard board />` lists every page's one-liner by status. Three levels: line, card, page.

## 0.97.0 - 2026-11-19

- `tools/related_eval.py`: offline test of related-page suggestions for threads (TF-IDF vs bge-small embeddings; precision@3, recall@3 and a threshold sweep), with the pages an agent linked in a thread as ground truth. Run niced, nothing is wired into the overlay yet.

## 0.96.1 - 2026-11-19

- RouteMap popup: sits above the cursor so it no longer covers the path, stays inside the map box, wraps long names, and scales strip frames to 160 px.

## 0.96.0 - 2026-11-19

- RouteMap: a recording may carry `thumbs: {src, size, at}`, one horizontal strip of frames with the point index of each; hovering shows the nearest frame.

## 0.95.0 - 2026-11-19

- RouteMap: a recording with `frames: {src, count}` shows the frame nearest the cursor as you move along its path. Fixed the pointer position when the map is letterboxed.

## 0.94.0 - 2026-11-19

- `:me NAME`: new comments and highlights carry your name; a named highlight (and its bubble) is painted in that person's own colour.
- `:labels` exports all comments as JSON lines (text, quote, person, page version, last agent reply) for labelled examples; also `GET /labels`.

## 0.93.0 - 2026-11-19

- `<RouteMap src="…/routes.json" />`: a pan and zoom top-down map with Routes, Recordings and Datasets layers; recordings link to their `url`. Data format in the docs; `examples/map.md` has a demo. Needs the data feed from the site manager and Sim.

## 0.92.0 - 2026-11-19

- Whisper: `/w name text` in a thread reply is addressed to, and readable by, only the named agents. Others reading the thread do not get it (saves their tokens); you see it marked 🤫 with a dashed box. Threads only, not rooms yet.

## 0.91.0 - 2026-11-19

- What's new: opening a page now glows the passages that changed instead of showing a diff first. `}` / `{` jump between them, `Space` marks one read; `O` opens the page in a new tab.

## 0.90.0 - 2026-11-19

- Threads and pages are linked both ways. A page with `from: <thread id>` (and optionally `author:`) in its front matter shows up on that thread as a `📄` link, and in the page's history as *Led to this page*, apart from the threads *Written on this page*. New `GET /pagelinks`.

## 0.89.1 - 2026-11-19

- Fixed: replying to (`q`) or branching from an agent's message failed with "to must list at most 12 short names". The message's display name ("ADR agent") was used as the recipient instead of its slug ("adr-agent"); it is now mapped to the team member, and dropped if unknown.

## 0.89.0 - 2026-11-19

- What's new: status bar count of pages changed since you last left them; `n` (or `:new`) lists them newest first and opens the changed lines of a page, all with Vim keys (`j/k`, `l`, `h`, `m`, `M`). Pages keep a snapshot of the copy you last saw.
- **↳ New thread** now addresses the child thread to whoever wrote the quoted message and quotes the last message when nothing is selected or focused (it was addressed to the default recipient).

## 0.88.2 - 2026-11-19

- Comments and replies now render relative links (`[x](./page)`, `../page`) as links; before only `http(s)` and `/path` links did.

## 0.88.1 - 2026-11-18

- company theme now follows the company deck: pure black background, white text, lilac (#C2B1FF) accent in dark; white with black rules in light. Replaces the navy first guess.

## 0.88.0 - 2026-11-18

- Theme picker button next to the light/dark toggle: π (default style) or N (company theme). Choice is remembered.

## 0.87.0 - 2026-11-18

- company brand theme (Brand Guide colours, Funnel Sans), opt in with `?theme=company` (remembered; `?theme=default` turns it off). Works with the light/dark toggle.

## 0.86.0 - 2026-11-18

- Light/dark theme toggle in the nav bar (default dark, choice remembered). Sites that set `appearance: "force-dark"` in their own config keep it; change it to `"dark"` to enable the toggle.

## 0.85.1 - 2026-11-18

- Page tree: `o` opens the selected page in a new tab; Ctrl/Cmd-click or middle-click on a row does too. (Shift+L was already "expand all".)

## 0.85.0 - 2026-11-18

- Published sites get a build badge (live commit and time, "New version live", and with a token the live build steps) and table editing: `{editable}` cells can be edited on the published page, queued, and published as one commit to the branch with Saved, Building, Deploying, Live or Failed progress. Needs `editableTables` and `buildEnd: buildInfo` in the site's config; see `docs/preview-comments.md`.
- The cell read and write logic moved to `src/table-cells.mjs`, shared by the preview server and the published site.

## 0.84.1 - 2026-11-18

- DocGraph node titles and bodies show `code` in backticks as inline code (monospace on a tinted background), so topic and node names stand out.

## 0.84.0 - 2026-11-18

- Editable tables in the live preview: put a blank line and `{editable}` (all columns) or `{editable: Col A, Col B}` under a table, then double-click a cell, type, and press Enter to write it into the page's markdown file (Esc cancels). Only the marked table and columns are writable, and a save is refused if the file changed since you started editing. The marker line is not shown. Not available in exports or on the published site yet.

## 0.83.3 - 2026-11-18

- Read aloud starts the text-to-speech server itself when it is down (the first read then takes about a minute). `:tts on|off` turns that off; `:settings` shows it.
- Fix: `tools/tts.mjs start` could skip launching the server because its own ssh command matched the "already running" check.

## 0.83.2 - 2026-11-18

- Fix: the interface scale (used by bubbles and the thread popup when the browser is zoomed out) remembered the largest pixel ratio ever seen on the site, so a ratio from another monitor made the popup oversized at 100% zoom. The baseline is now stored per screen size.

## 0.83.1 - 2026-11-18

- `--serve --exclude <glob>` (repeatable) leaves matching files out of the served bundle; globs are relative to the site root, so `public/data/v0/**` is `data/v0/**`.
- A single-page export that needs a zip no longer writes a zip to a path ending in `.html`; the file is named `.zip` instead.
- Known: the zip export's `media/` links are relative, so it is meant for `file://` (unzipped); to serve over http use `--serve`.

## 0.83.0 - 2026-11-18

- `npm run export -- site/index.md --serve` writes a served bundle: the whole built site (every page, plus everything under `public/` such as wasm viewers and data files) and `serve.py`, a tiny local web server (`python3 serve.py [port]`). For sites whose components fetch files at run time, which cannot work from `file://`. Pages route normally (including `/page` without `.html`). Add `--page /x` (repeatable) to limit the pages. The normal single-file and zip exports are unchanged.

## 0.82.1 - 2026-11-18

- The thread popup opened from a page bubble now stacks above region rectangles, and its size is limited to the window when the interface is scaled up for a zoomed-out browser, so it can no longer outgrow the screen.

## 0.82.0 - 2026-11-18

- Queued send: `Ctrl+Shift+Enter` in the comment or reply box sends without pinging. The agent gets it when it next goes idle (the hosting agent via its usual idle check, mesh agents once their status is no longer "working"), instead of interrupting what it is doing. `Ctrl+Enter` still sends right away.

## 0.81.4 - 2026-11-18

- Region rectangles are anchored to the smallest element that contains the whole drawn area, so they stay put when small elements reflow.

## 0.81.3 - 2026-11-18

- Fixed: the region rectangle vanished once the comment was sent, because the region was dropped from the saved comment. It is now saved and stays while the thread is unresolved or has unseen replies.

## 0.81.2 - 2026-11-18

- Fixed stacking: the region rectangle and bubbles now sit below the comment box and the Comment popup, not on top of them.

## 0.81.1 - 2026-11-18

- The region rectangle now appears (dashed) as soon as the region is captured, before the comment is sent, and goes away on cancel.

## 0.81.0 - 2026-11-18

- A region comment (`s`, then drag) now leaves a rectangle on the page in the thread's colour, with the usual bubble on its corner. The rectangle follows the element it was drawn on when the layout changes. Threads made before this have no rectangle.

## 0.80.1 - 2026-11-18

- Clicking a button or form field on a page no longer pops up the comment offer. Controls are comment targets only while choosing one with `c`.

## 0.80.0 - 2026-11-18

- A site can add its own dev-server plugins to the preview: `<site>/.vitepress/preview-plugins.mjs` default-exports an array of Vite plugins, or a function of the document root returning one. Preview only; exports and the published site ignore it. (Lets a page start a local helper process through an endpoint the site defines.)

## 0.79.2 - 2026-11-18

- A page can start region-comment capture (as the `s` key does) with `document.dispatchEvent(new CustomEvent("preview-comment-region"))`, so embedded canvas or iframe content (such as the Rerun viewer, whose text cannot be selected) can offer a "comment on a region" button.

## 0.79.1 - 2026-11-17

- Graphs open fitted again (the 0.79.0 start-zoomed behaviour is removed).
- The index (left sidebar and "On this page") is hidden by default. A **+ Show index** / **− Hide index** button, or `\`, toggles it; the choice is remembered.

## 0.79.0 - 2026-11-17

- Graphs (DocGraph) now open at a readable size: if fitting everything would make node text small, the view starts at 100 % zoom (centred, or at the top-left corner for a tall graph) and the rest is a pan away. `0` or `:fit` still shows all.
- New **⇤ focus** button (and the `\` key) hides the side columns (index and "On this page") so content and graphs use the full width. The choice is remembered.

## 0.78.1 - 2026-11-17

- The mesh data directory moved to `~/.agent-mesh`. ADR now reads the mesh database and `machines.json` from `MESH_DIR`, else `~/.agent-mesh`, else the old extension folder.

## 0.78.0 - 2026-11-17

- New **Room** tab in the Team panel: shared rooms (faces) between three or more mesh members, you included. Create one with **＋ New room** (topic and member chips) or let an agent call `room_open`. The log shows only posts made into that room; Ctrl+Enter posts as you; an unread dot marks new posts. Needs the agent-mesh extension with room support.

## 0.77.1 - 2026-11-17

- Fixed: grouping a table that was also sorted by another column repeated the group rows. Groups are now contiguous, in the order they first appear.

## 0.77.0 - 2026-11-17

- Published site and preview: every content table with more than two rows can be sorted by several keys and grouped. Click a header to sort (again to reverse, a third time to clear), Shift+click adds a further key; **Group by** adds collapsible group rows. The choice is remembered per page and table in the browser. Numbers and ISO dates sort by value.

## 0.76.0 - 2026-11-17

- To: recipient chips show each agent's mesh status as an icon (🔨 working, ⏳ waiting, ❓ asking, 💤 idle, 👀 online, 🌙 offline) with the current task on hover, so you can see who is busy before sending.

## 0.75.2 - 2026-11-17

- Team load panel: load colours are now green/orange/red (distinct from the agent-status legend) with a key, and the −60 min/now axis sits under each machine's sparkline.

## 0.75.1 - 2026-11-17

- Team load panel: the load history and the per-core/GPU detail now sit together per machine (no duplicated rows); per-core bars have a 0–100 % scale, a % number per core and a per-host average; GPU util/VRAM text moved outside the bars for contrast.

## 0.75.0 - 2026-11-17

- Team load panel (the `/team` page and the overlay's Team panel): btop-style per-core CPU bars for each machine, and one nvtop-style row per GPU (utilisation, VRAM used/total, temperature, power). Needs the updated `mesh-load-sample` (dotfiles) on each host; hosts running the old sampler keep the single load line.

## 0.74.0 - 2026-11-17

- The published site (`build:site`) has fuzzy full-text search (VitePress local search). The live preview is unchanged.

## 0.73.1 - 2026-11-17

- Full-screen history/chat now follows the page width instead of a fixed 1000px column.

## 0.73.0 - 2026-11-17

- Agent names get a colour and icon derived from the name, in chat threads, the Team table and the Team graph.

## 0.72.1 - 2026-11-17

- `f` (or ⛶) toggles the comment history and chat panel full screen.

## 0.72.0 - 2026-11-17

- Drop or paste images into the comment panel or an open thread; they attach like region screenshots. Images in a thread now have a **×** to delete them.

## 0.71.1 - 2026-11-17

### Fixed

- An agent's new thread now shows the agent's name as sender (`add_doc_review_comment` takes `as`), so quoting it with `q` addresses the reply to that agent.

## 0.71.0 - 2026-11-17

- Viewed marks: a blue dot in the page tree, breadcrumb and "Pages below" marks pages that changed or are new since you last left them. A page counts as viewed when you navigate away or close the tab; existing pages count as viewed on first use. State is a hash per page in `<site>/.adr-data/viewed.json` (`/viewed` endpoint).

## 0.70.0 - 2026-11-17

- Messages render Markdown tables and `>` quotes (nested). Quotes whose table rows were flattened onto one line are cut back into rows.
- Several quotes in one reply: each `q` appends another `>` quote to the reply box, so you can write between quotes and answer multiple passages in order. A selection inside a table keeps its rows.
- The reply and comment text boxes grow with their text, up to a maximum height.

## 0.69.0 - 2026-11-17

- New tool `unanswered_threads(as, store)`: a state check agents run at a natural pause. It lists open threads addressed to the agent whose last word is the user's, with age and a one-line quote, and always states the count ("checked: 0 unanswered"). Read-only: unlike `read_doc_review_comments(include_seen=true)` it leaves read receipts alone. Requested by the PC lead (mesh #1693).

## 0.68.5 - 2026-11-17

- Fix: comment notes to agents are now sent at `high` priority. At `normal` the mesh shows only a 70-character "not urgent" hint, which busy agents skipped, so Nicklas's replies went unread for hours even though the notes were delivered to their inbox.
- Monitoring: every unexpected server exit (crash, signal, give-up) is also appended to `<state>/<store>.failures.jsonl` (`{at, pid, reason}`), and the watchdog sends a mesh note to the owning agent (the store's session id). A normal stop is not recorded there.
- Fix: a comment or reply to an agent that was not on the mesh at that moment ("Recipient is not active") was dropped, so the agent never woke. The server now retries every minute (up to 6 h) until the note is delivered or the agent has read the thread.
- Fix: the server crashed ("Cannot set properties of undefined (setting 'ready')") when the embedding worker exited while starting.

## 0.68.4 - 2026-11-17

- The page tree shows a hollow ring with a count for pages that have open threads waiting on the agent. Before, only threads with something new for you got a ball, so an unresolved thread you had just replied to showed nothing.

## 0.68.3 - 2026-11-17

- Fix: mesh comment notifications named the addressed agent where the server name belongs (`store="mokki-agent"`); they now give the server name (or store id).
- An unknown `store` returns a readable error ("Unknown store ..."), not "Tool execution failed".

## 0.68.2 - 2026-11-17

- Client/server skew no longer hides comments: a client that finds no `/history-recent` (older server) falls back to the full history.
- `adr list` and tools no longer call a live server dead (and delete its `connection.json`) when its pid is not visible, e.g. from an agent sandbox with its own pid namespace; a server whose port still answers counts as running.

## 0.68.1 - 2026-11-17

- Fix: the site data directory is now `<site>/.adr-data/` (was `.adr/`, which a site may already use, e.g. as a symlink to the ADR checkout, so comments and a `.gitignore` were written into that checkout). A data directory that resolves outside the site folder is refused. Existing 0.67/0.68 data in `.adr/` is not migrated; move it by hand if you have any.

## 0.68.0 - 2026-11-17

- Big sites stay light: the overlay first loads open threads and anything touched in the last 14 days (`/history-recent`); older resolved threads load when needed (History tabs All, Resolved or Page history, `:grep`, semantic search, or a link to such a thread). The history header says how many are not loaded.

## 0.67.3 - 2026-11-17

- `adr` starts only one server per folder. A second launch for the same folder prints the running server's URL and exits (code 0 for the same store, so resume scripts can run it every time; code 1 if a different store was asked for).

## 0.67.2 - 2026-11-17

- `start_doc_review` no longer starts a second server for a folder that a standalone server already serves (two servers would write the same comments and drift apart). It returns that server's URL and the `store` name to pass to the other tools.

## 0.67.1 - 2026-11-17

- The folder is the identity: `adr . -d --name NAME` in a site folder finds its store by itself (`.adr-data/store`, else the store an earlier server for that folder used), so `--store` is no longer needed, including for sites that were first served by an agent session. The id is recorded in `.adr-data/store`.

## 0.67.0 - 2026-11-17

- A standalone server keeps its data with the site: comments, settings, images and audio live in `<site>/.adr-data-data/` (self-ignoring via `.adr-data/.gitignore`), so they follow the folder instead of a session id. A store that lived in `~/.local/state/agent-doc-review/<id>/` is moved there on the next start; runtime files (connection, exit log) stay in the state directory.
- Agent tools (`store`) accept a server name, e.g. `store="mokki"`, or the site directory, as well as the store id; mesh notes now name the server.

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

- Agent replies are named without an `as` argument: the tool sends its session id and the server looks the name up in the team roster, so threads show e.g. "mokki" instead of "Copilot". Each agent needs the updated plugin (new session or extension reload).

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

- `adr <folder> --name mokki` names a server; open it as `http://mokki.localhost:PORT` (any `NAME.localhost` reaches the same server, comments included). The port is still needed.
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

- Classification banner: `classification:` and `classification-level:` (restricted / internal / public) in the root `index.md` front matter show a thin fixed strip on every page, in the preview, the static build and offline exports. Requested via the mokki agent.

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

- DocGraph: edges meeting the same side of a node now attach at separate points, ordered by where the other end lies so lines do not cross; opposite-direction edges between the same pair run side by side. Solid and dashed edges alike. Elbows are drawn as explicit segments, so corners are square (the old rounded taxi corners are gone). Requested via the mokki agent.

## 0.25.1 - 2026-11-14

- Export: dead links to pages outside the single-page build no longer abort it (`ignoreDeadLinks`); the document may be the page's own file or any file in the site (the site root is found by climbing to where the page path resolves); a missing page now says which file to pass.

## 0.25.0 - 2026-11-14

- Offline export of a page: **Export** button (also `:export`) in the preview, or `npm run export -- <file.md> [--page /path] [--out file] [--zip] [--inline-media-under <MB>]`. Works without a Copilot session. Produces one self-contained `.html` (script, styles, fonts, images, graph JSON inlined; opens from `file://` with an interactive DocGraph and no comment UI), or a `.zip` with `media/` when the page has media over 2 MB. Localhost iframes become a placeholder and are reported as warnings; links to other pages are inert. Only the exported page is built, so broken front matter elsewhere cannot block it.

## 0.24.0 - 2026-11-14

- `adr <file.md> [port]`: standalone launcher (package `bin`), no Copilot session needed. Each document gets its own stable comment store instead of one shared placeholder session. Install with `ln -s <repo>/bin/preview.mjs ~/.local/bin/adr` (or `npm link` where the global prefix is writable). Validates the file and port.

## 0.23.1 - 2026-11-14

- `update_doc_review_comment` accepts an optional `proposal` (`before`/`after`): the diff card is posted as a reply inside the existing thread, with its own Accept/Reject. Several cards per thread work. Requested via the mokki agent.

## 0.23.0 - 2026-11-14

- Vim normal mode scrolls the page smoothly: `j`/`k` tap or hold, `gg`/`G` animate. Line-by-line caret motion (`h/j/k/l/w/b/0/$`) now needs caret mode (`i`, status `CARET`, `Esc` to leave); the caret is shown only there. Graph layer unchanged. Requested via the mokki agent.

## 0.22.3 - 2026-11-14

- Workstream tickets: optional `resume` front-matter field (in the JSON board) and `workstreams/template.md.example` as the ticket template (from the mokki agent).

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
