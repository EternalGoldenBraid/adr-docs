# Changelog

## 0.192.0 - 2026-11-24

- A vote can state its precision: `cast_doc_review_vote(..., precision="low"|"high")` or `adr-vote --precision low`. It is stored with the vote, hidden until the round is revealed, then shown in the round as `precision: {agent: level}` (ticket `vpcast`, thread 8f15dd42).
- Removed: nothing this time.

## 0.191.0 - 2026-11-24

- Enter sends in every comment, reply, edit and room box; Shift+Enter is a new line. Ctrl/Cmd+Enter still sends, and Ctrl+Shift+Enter still interrupts. Enter still picks from an open `@` list, and does not send while an IME is composing.
- Removed: nothing this time.

## 0.190.0 - 2026-11-24

- `Q` (Shift+q) on a focused agent message quotes it and whispers the reply to that agent alone: the To: chips narrow to them. `Q` on more agents' messages adds each one. A plain `q` quotes for the whole room again (thread 28abcf10).
- Removed: nothing this time.

## 0.189.0 - 2026-11-23

- `:set` (also `:settings`) opens a vim-navigable settings list: j/k move, h/l change, 0 resets, Esc closes. It holds site font size (70–160%, page text), review UI size (80–150%, panels and bubbles), newest-first order, vim keys, full-screen threads and read aloud. Changes apply at once and stay in this browser.
- Removed: nothing this time.

## 0.188.0 - 2026-11-23

- The discussions rail beside a thread (`:rail`) is gone: the tabs and the thread list already show the same open and waiting threads, and it was off by default and unused.
- Removed: the `:rail` command, the rail panel and its stored preference.

## 0.187.0 - 2026-11-23

- `cast_doc_review_vote`, `request_doc_review_votes` and `reveal_doc_review_votes` return their error as text instead of "Tool execution failed", and say to pass `store` when the session has no preview of its own (the likely cause of the failed casts on the start-value vote).
- Removed: nothing this time.

## 0.186.0 - 2026-11-23

- Votes need a quorum: a round decides an item only with 3 votes (fewer if fewer than 3 voters were asked). When the deadline passes below that, the lead is told once, the round stays open and nothing is decided or auto-revealed; `reveal_doc_review_votes` below the quorum needs `force` and never decides.
- A decided item can be reopened: `request_doc_review_votes` with `reopen: true`, or `adr-vote --reopen PAGE ITEM`. The weight is cleared and the next request starts a new round.
- Removed: nothing this time.

## 0.185.0 - 2026-11-23

- A thread opened from its page bubble is a compact window again: no thread list, tabs, counts, Team/Autopilot buttons or rail, and Esc closes it. It is still the one thread UI (reactions, whisper completion, reload restore). `f` or ⛶ goes full screen with everything back, and leaving full screen returns to the compact window. `-` `h` still opens the full history.
- Removed: nothing this time.

## 0.184.0 - 2026-11-23

- One thread UI: clicking a thread's bubble on the page now opens the full thread view (reactions, whisper completion, full screen, restore after reload) instead of the small popover. Bare highlights and private notes keep the popover.
- Alt+Shift+h/j/k/l moves the open panel (comment, history or team) by the resize step; the position persists like a drag. Documented in `docs/preview-comments.md`.
- Removed: the duplicate thread UI in the bubble popover for comment threads (still used for bare highlights and notes).

## 0.183.0 - 2026-11-23

- DocGraph: clicking into a graph that is partly below the fold or under the page header scrolls the whole canvas into view, so a layer that fits the canvas is no longer cut off at the top or bottom of the window. (`0` refits; `f` goes full screen.)
- Removed: nothing this time.

## 0.182.0 - 2026-11-23

- Graph full screen: with the graph active, `f` (or `:full`, or the ⛶ Full button) toggles browser full screen for the whole graph, toolbar and status line included; Esc leaves. The view refits on every change. Listed in the graph's `:help`.
- Removed: nothing this time.

## 0.181.0 - 2026-11-23

- A "typing" line in an open thread: when an addressed member's own session log says it is working, the thread shows "● name is working · thinking" (or the tool's name, "· on this thread" when its queue item names this thread, or "waiting on a permission prompt"). It reads only the log-derived state, never tool arguments, and polls every 6 s while a thread is open. It needs the mesh; without it nothing shows.
- Removed: nothing this time.

## 0.180.0 - 2026-11-23

- The comment panel survives a reload: full screen is remembered as a preference, and the open thread, its scroll position, the focused message (or list card) and the list tab come back too, for the same page within ten minutes (was one minute).
- Removed: nothing this time.

## 0.179.0 - 2026-11-23

- Comments render math: `$…$` inline and `$$…$$` display LaTeX become MathML (Temml, bundled), which is real text you can select and copy; hover shows the TeX. `$5 and $6` stays plain. Fenced code blocks (```), also inside a `>` quote, now render as code instead of showing the fences.
- `/w name text` works after a quoted reply: the autocomplete, the whisper banner and sending all skip the quoted lines, and the whisper's recipients replace the quote's.
- Removed: nothing this time.

## 0.178.0 - 2026-11-23

- Graph search: with the graph active, `/` (or `:grep RE`) searches only that graph, across every layer, over title, text, status, code, link and layer path. Enter jumps into the node's layer and selects it; Ctrl-n/p or arrows move; Esc closes. The page's own `/` search is unchanged and works when the graph is not active. Documented in the graph's `:help`.
- Removed: nothing this time.

## 0.177.0 - 2026-11-23

- Reactions on a single message: every message in a thread has a 👍 ✅ ❤️ 👀 picker (shown on hover); reactions group into counted chips under the message, and clicking your own chip removes it. They are quiet and wake nobody. GIFs are skipped.
- Removed: nothing this time.

## 0.176.0 - 2026-11-23

- Reactions: 👍 ✅ ❤️ 👀 buttons on a thread's reply form save a one-emoji reply that wakes and announces nobody. GIFs are not included (external services leak requests).
- Removed: nothing this time.

## 0.175.0 - 2026-11-23

- Voting: one request can name several tests (`items`); each voter gets a single note with the page, the tests, the window and an `adr-vote --page PAGE --as ME test=score ...` line that works without the agent tool. The round is revealed automatically when the window closes or the last vote is in, and the lead's note carries min, max and median. Votes stay on the server until then.
- Removed: nothing this time.

## 0.174.1 - 2026-11-23

- Code map profiles are a dropdown on the graph instead of extra top-level boxes: a map may list `profiles` and give nodes `profiles: {name: [x, y]}`; choosing one hides the other nodes and lays the rest out again. The generator builds them from the config's `profiles` (regex excludes on tracked file paths), so only files on disk count.
- Removed: the per-profile top-level ROS boxes of 0.173.1.

## 0.174.0 - 2026-11-23

- Voting window: `request_doc_review_votes` defaults to a 5-minute window and takes `close_to` (default `site-manager`). When the window closes, or the last voter casts, that lead gets one mesh note with who voted and who is missing; they host the min/max discussion and the owner reopens the next round with another request.
- Removed: nothing this time.

## 0.173.2 - 2026-11-23

- Code viewer: stronger contrast for the active line, selection and block cursor.
- Removed: nothing this time.

## 0.173.1 - 2026-11-23

- Code map: config `profiles` give one ROS level per setup (`all`, `field`, `numpy`, `ue5`), each a top-level box with its own excludes.
- Removed: nothing this time.

## 0.173.0 - 2026-11-23

- Code viewer: `c` comments on the selected lines (`v` to select, or the current line in normal mode), so code can be discussed with the agents. The review client now loads in the viewer; editing stays out.
- Removed: nothing this time.

## 0.172.3 - 2026-11-23

- Code map: the config's `ros_exclude` (regexes on file paths) keeps offline tools out of the ROS level, columns are ordered to cut crossings and rows are spaced wider so topic labels no longer collide. Excluded files stay reachable through the repo tree.
- Removed: nothing this time.

## 0.172.2 - 2026-11-23

- Code map: the ROS level wraps into bands of four columns so it fits a normal screen, and DocGraph never fits a layer below 50% zoom (labels stay readable; pan with swipe, `h j k l`, zoom with `+`/`-` or pinch).
- Removed: nothing this time.

## 0.172.1 - 2026-11-23

- Code map: the ROS level now flows left to right (cycles no longer push every node into one column), one edge per node pair with up to two topic names, and `"links"` in the config add edges the code does not show (e.g. a UDP link to a bridge). DocGraph: `o` opens the source of the selected box in normal mode too.
- Removed: nothing this time.

## 0.172.0 - 2026-11-23

- Code map: `scripts/codemap/codemap.py config.json` turns git repositories into one nested DocGraph, one level per click: repo → folders → files → classes and functions → methods, plus a machines level from compose files and a ROS level (publishers and subscribers joined by topic). Every box carries a `</>` source link; `--check` lists files no box points to.
- DocGraph: Backspace goes up a layer, a clickable path (Top › folder › file) shows where you are, a layer with one box no longer zooms to fill the screen, and Enter or double click on a box with a layer opens the layer before the source (`o` still opens the source).
- Removed: nothing this time.

## 0.171.1 - 2026-11-23

- Fix: a page whose URL ends in `.html` now finds its file, so the page owner's resolve closes its threads there too.
- Removed: nothing this time.

## 0.171.0 - 2026-11-23

- A page's `owner:` (front matter) and the agent that started a thread can close and reopen it with their resolve. Other agents' resolves stay quiet marks. Applies to resolves from 05:50Z on 2026-11-23.
- Removed: nothing this time.

## 0.170.0 - 2026-11-23

- Only the human closes a thread. An agent's resolve is a quiet mark that closes nothing. Threads resolved before this change stay as they were.
- Removed: the per-member resolve chips, the resolve pie and "waiting on" text, the "Unresolve" state, and the 🔔 ping button.

## 0.169.0 - 2026-11-23

- Autopilot per agent: `POST /settings { autopilotAgent: { agent, hours, brief } }` turns it on for one agent, `{ agent, off: true }` ends it. That agent gets no idle nudges and carries the autopilot note; others are unchanged. `GET /settings` lists `autopilotAgents`, so a team page can show a toggle.
- Removed: nothing this time.

## 0.168.0 - 2026-11-23

- Agents are no longer chased for resolve votes: `unanswered_threads` and idle nudges list only threads that ask the agent something. Resolve marks still show and still close a thread; `Shift+R` and the bell still ping by hand.
- Removed: the "to resolve" items in agents' queues, the resolve-vote idle nudge and the count of resolves in the open-work total.

## 0.167.0 - 2026-11-23

- Autopilot: `:autopilot HOURS [brief]`, or the button in the history header. For that time ADR sends no idle nudges, and mesh notes and `unanswered_threads` tell agents to keep working, post one finish report and not wait for votes or resolves. `:autopilot off` ends it early; the status bar shows AUTOPILOT.
- Removed: nothing this time.

## 0.166.14 - 2026-11-22

- Fixed `Shift+R`: it failed with "Update ID must contain 1–36 UTF-8 bytes" because the ping carried no update id.
- Removed: nothing this time.

## 0.166.13 - 2026-11-22

- `Shift+R` in a thread pings everyone who has not resolved it: a short "resolve vote please" reply addressed only to them.
- Removed: nothing this time.

## 0.166.12 - 2026-11-22

- Fix: a thread could not resolve because the store's placeholder owner name (`agent-doc-review-site`, no session) had joined its members, for instance through a whisper, and held a seat nobody could fill. Seats are now only the human and roster agents, in the server's count and in the thread's resolve marks.
- Removed: nothing this time.

## 0.166.11 - 2026-11-22

- Fix: opening a thread by link, bubble or "thread xxxxxxxx" mention switched the list to "all", so Back showed every thread on the site. The list now stays on the tab you had, which starts as "This page" (open threads written on or leading to the page).
- Removed: the forced "all" filter when opening a thread.

## 0.166.10 - 2026-11-22

- Fix: a reply or resolve from an agent whose tool call named no `as` was recorded under its display name ("Predictive coding lead"), so its resolve mark and answers never counted. It is now recorded under its roster slug. Marks already recorded under a display name stay uncounted; resolve again to count it.
- Removed: nothing this time.

## 0.166.9 - 2026-11-22

- Fix: the whisper check counted names that have no chip (the owner, you), so it could name people you could not see and whisper with only one visible chip. Only the chips shown count now.
- Removed: nothing this time.

## 0.166.8 - 2026-11-22

- Fix: unticking the last To: chip in a thread reply put the store owner back, which 0.166.5 then sent as a whisper to the owner. A thread reply may now have no chip ticked, meaning a normal message to the whole room.
- A thread reply now shows "🤫 Whisper: only … will get this" under the box whenever the chips leave someone out, before you send.
- Removed: nothing this time.

## 0.166.7 - 2026-11-22

- Fix: a whisper sent from the thread panel still sent a mesh note to every member of the room (the whisper text itself stayed hidden). It now notifies only the people it names.
- Removed: nothing this time.

## 0.166.6 - 2026-11-22

- Typing `/w ` in a thread reply now completes team names like `@` does (a comma adds another name, a space ends the list).
- The `mute` tool parameter carries the agents' self-care rule: mute after two notes in a row that are not for you.
- Removed: nothing this time.

## 0.166.5 - 2026-11-22

- In a thread reply, leaving someone out of the To: chips now whispers to the ones picked; the default (everyone) is a normal room message. `q` (quote) no longer narrows the chips, so quoting never whispers by accident. `/w` still works.
- Removed: the `q` quote's automatic narrowing of recipients to the quoted message's author.

## 0.166.4 - 2026-11-22

- "Unread" on a thread card now only ever means you have not seen a reply (the NEW mark). Whether an agent has read your message moved to a hover on the thread's status line: who has read it and who has not yet.
- Removed: the "unread" card badge and its yellow card state (it meant "the agent has not read you", which looked like your own unread).

## 0.166.3 - 2026-11-22

- Fix: a muted thread still produced an "Answer thread" queue item, because `threads.json` (which the site's queue generator reads) listed muted members. It now leaves them out.
- Removed: nothing this time.

## 0.166.2 - 2026-11-22

- A "thread xxxxxxxx" mention in a message (linked or plain) now opens that thread, on its own page if needed; before, a link to the page went nowhere near the thread. The thread header shows its 8-character id; click to copy.
- Removed: nothing this time.

## 0.166.1 - 2026-11-22

- Fix for 0.166.0: replaying the log made old threads add everyone ever addressed as a member, so agents got nudges to resolve threads from days ago (11 for one agent). Members now accumulate only from records after 2026-11-22T08:30Z; older records keep the old rule.
- Removed: nothing this time.

## 0.166.0 - 2026-11-22

- Threads are rooms. Everyone ever addressed in a thread stays a member and sees every reply; before, each reply's addressee list replaced the thread's members, so whoever was left off lost the thread. `to` on a reply now only says whom to ping; a reply with no `to` notifies every unmuted member.
- Mute: the 🔕 button in the thread header (and `mute: true|false` on `update_doc_review_comment`) keeps you in the thread but stops notes and nudges for new replies, unless a reply names you in `to`. Muted members are not needed to resolve.
- Not built yet: leaving a thread outright, and a read mark per member in the header.
- Removed: nothing this time.

## 0.165.3 - 2026-11-22

- An update from a session that is not in the team roster and gives no `as` is now refused with "pass as: your agent slug", instead of being recorded as "copilot", where its resolve counted for nobody and left the "Resolve thread" queue item standing (thread f9ed8652). Sites with no roster behave as before.
- Removed: nothing this time.

## 0.165.2 - 2026-11-22

- Waiting can name a catalog `run` (ends when done, unknown, or silent 10 min) or a `thread` (ends when someone else replies); a wait that names nothing is capped at 30 min (was 2 h). The team table shows what each agent waits on (thread f9ed8652).
- Removed: nothing this time.

## 0.165.1 - 2026-11-22

- `declare_doc_review_waiting` takes a local `pid`: the wait ends when the process exits (Alice's idea, thread f9ed8652). Without a pid it is capped at 2 hours, so it cannot quietly mute the queue.
- Removed: nothing this time.

## 0.165.0 - 2026-11-22

- Quieter idle nudge (thread f9ed8652): `declare_doc_review_waiting` stops nudges while an agent waits on a job or a question; each unanswered nudge doubles the gap up to 60 min; queue items with a non-empty `held` are skipped; the note no longer says "no reply needed" and says how to declare waiting.
- Not yet: waiting that ends when a named catalog run finishes, and a daily digest to the user.
- Removed: the "no reply needed" wording from the idle nudge.

## 0.164.1 - 2026-11-22

- The thread panel and the open thread survive a page reload (a page edited by an agent, or a restart): the same page reopened within a minute restores them. Unsent replies already survived.
- Removed: nothing this time.

## 0.164.0 - 2026-11-22

- Vote requests are state (thread 41d0772f): `request_doc_review_votes`, `cast_doc_review_vote` and `reveal_doc_review_votes` agent tools (also `adr-vote --request`) and `/agent-vote`. A request notifies each voter and writes `votes-queue.json` ("Vote on X" per voter; "Reveal X" for the requester when all have voted; "Close X on the votes in" after the deadline). Fixes agents having no `adr-vote` on their PATH. Test added.
- Removed: nothing this time.

## 0.163.1 - 2026-11-21

- Fix: no human/agent split in resolving (thread d75ea297). Your name in `to` and your own Resolve are one seat, instead of "only agents are waited on"; everyone else in `to` is waited on alike. Test added.
- Removed: the 0.163.0 filter that dropped non-team names from the resolve marks.

## 0.163.0 - 2026-11-21

- Removed: the **Close for all** button and its confirmation (thread d75ea297); threads close when everyone has resolved, and the 🔔 asks whoever is left.
- Fix: a human in a thread's `to` (you, listed as a second "Alice") no longer needs a separate resolve; your own mark covers it. Only team agents are waited on.

## 0.162.0 - 2026-11-21

- `@agent` in a comment or reply adds that team member to the thread's addressees (thread a1850ba0), so a mention wakes them; non-team handles and emails are ignored. Test added.
- Removed: nothing this time.

## 0.161.1 - 2026-11-21

- Fix: "Close for all" no longer refuses because the user's own seat (or another human) is listed as an addressee that "can still be reached" (thread d75ea297). Humans and `you` are not counted as pending agents.
- Removed: nothing this time.

## 0.161.0 - 2026-11-21

- Card tests can carry a machine check (thread 56b94a00 on /experiments/2026-11-21-live-data-loop): `check: {experiment, field, stat, op, value}` shows as a chip (`min(err) < 0.1`) on the test row. `measured: <number>` and `result: pass|fail` (written by the site's `verify_checks.py`) show as "0.03 pass (hypothesis)" or "measured, not met". A `result:` that is not pass/fail still means a result file path, as before.
- Removed: nothing this time.

## 0.160.0 - 2026-11-21

- Code links open in ADR's own viewer on a local preview (thread d75ea297): `/__adr/code/<repo>/<path>#L12`, CodeMirror 6 with Vim keys (`@replit/codemirror-vim`), read-only, search, "copy vim +line", a GitHub button, `:q` back. It replaces the `vscode://` target of 0.159.0, because every user has their own editor. Online, the link still opens GitHub.
- The viewer reads only files inside a repo mapped in `code-repos.json`; no dot-folders, key or secret-looking names, no symlinks leaving the checkout, 2 MB cap, loopback hosts only. Test added.
- Removed: the `vscode://` link.

## 0.159.0 - 2026-11-21

- DocGraph code links (thread d75ea297 on /live-data-flow): a node can carry `code: "repo:path#L12"`. It shows `</>`; `o` in visual mode or a double-click opens it. `public/code-repos.json` maps each repo to a local checkout and a GitHub URL: a localhost preview opens `vscode://file/...`, any other host opens the GitHub blob. The node editor has a Code field.
- Removed: nothing this time.

## 0.158.0 - 2026-11-21

- `:rail on|off` (option C of workstreams/2026-11-21-lean-ui.md): a rail of open discussions grouped by page, `↔` for linked threads, beside the thread. Off by default, saved per browser, hidden below 1100 px. It is `:rail` because `:tree` already opens the page tree.
- Removed: nothing this time.

## 0.157.0 - 2026-11-21

- `:order newest|oldest` (option B of workstreams/2026-11-21-lean-ui.md): a thread can show the newest reply first with the reply box on top, so you no longer scroll to the end. Saved per browser; default stays oldest first. `j`/`k`, `g`/`G` and "new thread" follow the visual order.
- Removed: nothing this time.

## 0.156.0 - 2026-11-21

- Lean panel (option A of workstreams/2026-11-21-lean-ui.md): the tabs sit in the header row, the thread header shows the page path as a badge first, the long state sentence is gone (the resolve chips and a tooltip on the path carry it), and the composer, messages and margins are tighter. About a third more of a 14" screen shows messages.
- Removed: the separate tab row and the thread state sentence line.

## 0.155.3 - 2026-11-21

- Fix: a thread closed when every addressee had resolved, even if you had not (thread 48d85716 on /ops.html). Your mark now counts, as the docs always said. Threads opened before 2026-11-21 keep the old rule so history does not reopen. Needs a preview restart.
- **Close for all** now refuses while any addressee who has not resolved is still reachable (not offline); ring the bell instead. It still asks first for the offline ones.
- Removed: nothing this time.

## 0.155.2 - 2026-11-21

- Fix: the 🔔 bell answered "Unknown comment endpoint." since 0.151.0. The Vite proxy that forwards the panel's requests to the comment bridge did not list `/bell`, and I had only tested the bridge directly. Needs a preview restart.
- Test: every route the panel calls through `api()` must be on the proxy list.
- Removed: nothing this time.

## 0.155.1 - 2026-11-20

- Fix: calm mode no longer eats the page's own keys. It used to stop every key event at `document`, so handlers on `window` (the demo /console W A S D) never saw them. ADR's own handlers now skip the event in calm mode and the event carries on to the page.
- Test: `tests/calm.browser.mjs` drives a host window handler in calm and normal mode (needs a running preview).
- Removed: the event-stopping calm listener.

## 0.155.0 - 2026-11-20

- Calm mode: `:calm` makes ADR quiet on this page (`:calm site` on every page, `:calm off` to restore). Keys such as `s`, `t`, `n`, clicks and text selection no longer open comments or take screenshots, and the pill and marks are hidden, so a page with its own controls (the field console) is left alone. Only `:` still works, and the page's own key handlers still run. The status bar shows `CALM`, and `:help` (Search & commands) lists it.
- Removed: the need to fight ADR's shortcuts on pages that have their own.

## 0.154.0 - 2026-11-20

- Thread list: a thread with a reply you have not read now shows a red dot, bold title and preview, and `NEW` in front of the badge, so unread is unmistakable. Moving onto a card with the keys (j/k) marks it read after 0.7 s, and the dot goes; a quick pass over it does not count.
- Removed: having to open a thread to clear its unread mark.

## 0.153.1 - 2026-11-20

- Fix: a failed idle-nudge send was retried every 5 seconds (256 attempts at one agent in an hour) and each attempt was logged as a nudge. It now keeps the normal pace, and only delivered nudges are logged and counted in the answer rate. The storm also used up the per-pair send limit, which can make the 🔔 bell report everyone as not reachable.
- The bell now says why a send failed, next to the agent's name.
- Removed: the 5-second retry loop on failed nudges, and the unexplained "not reachable".

## 0.153.0 - 2026-11-20

- Verified state carries a log position: `chain {n, hash}`, the first 12 hex of the SHA-256 of the last 8 event ids of the session log. The Team panel shows it on hover ("Log position #…"). A reader holding `events.jsonl` recomputes it with `verifyChain(lines, hash)` in `src/verified-state.mjs`, so a state claim names exactly where in the log it was read. It is a commitment to a position, not a signature: the log owner can rewrite the log.
- Removed: the last event id as the only pointer into the log (it said where, but could not be re-derived from the preceding events).

## 0.152.0 - 2026-11-20

- Fix: an exported page with images in its markdown (for example the icons in a table) lost its graph and every other component. The export bundle turned each imported asset into `new URL(path, "")`, which throws "Invalid base URL" and stopped hydration. Those calls are now plain paths; the static markup already carries the inlined file. Found on `/field/2026-11-19` (thread 9298a248).
- Queue item to turn mapping (ticket verified-state): `GET /itemturns` gives, for each agent on this machine, the first interaction in which each queue item's id was told to the agent (`told`) or used in a tool call (`acted`), and how many items map to none (`unmapped`, `unmappedShare`). Remote agents are skipped. `itemTurns` in `src/verified-state.mjs`.
- Removed: the "Invalid base URL" error that aborted every exported page with a bundled asset import.

## 0.151.0 - 2026-11-20

- 🔔 Bell in the thread header (shown while someone has not resolved): sends a call for resolution to every addressee who has not resolved, immediately, naming the thread and page. It lists who was rung and who is unreachable. Server route `POST /bell {id}`.
- Smarter nudges: each agent's answer rate is learned from the logged nudges (`.adr-data/nudges.jsonl`, answered = a reply on that thread within 30 min), as a Beta(1,1) posterior mean. A thread closes only when all missing addressees answer, so an agent is nudged first about the thread with the highest closure probability p_a·∏p_b. The slots are independent per agent, so this is exact for the expected number of closed threads under that model. It does not yet coordinate two agents on one thread. See `src/nudge-plan.mjs`.
- Removed: the arrival-order pick of which waiting thread an idle agent is nudged about.

## 0.150.0 - 2026-11-20

- The floating panels (comment, history, Team, What's new, Help) can be dragged by their header, and the comment panel by its top strip. The position is remembered per panel; double-click the header to put it back.
- The Team panel resizes with the same keys as the other panels (Alt+h/j/k/l in vim mode, see `:keys`), and the size is shared and remembered.
- Removed: the fixed 640 px width of the Team panel.

## 0.149.1 - 2026-11-20

- Fix: `Shift+T` now opens and closes the Team panel. The docs said so since 0.148.0, but the key was never bound (the panel opened only with `:mesh`, the leader key then `m`, or the edge tab).
- Removed: the documentation claim of a key that did nothing.

## 0.149.0 - 2026-11-20

- Shift+T, Verified column: **what each agent is working on**. The queue items (`queues.json`) whose id, or for a thread item its 8-character thread id, appear in the agent's current interaction (the user message and the tool arguments since the last user message) are listed after `→`. Hover for the event that first named each one. A working agent with no match shows `→ unattributed`; there is never a guess.
- This is a relation, not a one-to-one map: a turn can name several items or none. It is exact only for agents that open work with a `STATUS <item-id> | running` line or an id in their commands; ticket slugs and prose mentions are not matched yet.
- Removed: nothing this time.

## 0.148.1 - 2026-11-20

- Fix: a GPU agent addressing a store by its id (e.g. `ddd31c98`) got "No running preview", because relays were matched on the folder name only. The bridge now tries the three most recently heard relays for the machine and each one checks the store itself; the first that serves it answers.
- Removed: the folder-name-only matching of relays, so a store id and a store name both work remotely.

## 0.148.0 - 2026-11-20

- Team panel (Shift+T): each agent now has a **Verified** column, read from the session's own `events.jsonl` (locally, or over ssh for the GPU machine), not from what the agent says. States: working (with the running tool), asking (unanswered permission prompt), idle, stalled (an open turn with no event for 10 min). Hover for the last event's type, id and time, which you can look up in the log.
- The agent's own `STATUS` line is kept as the **Claim** column. When it contradicts the log (claims free while a turn is open, or busy while the log has been idle for 2 min) it is marked `≠` in amber.
- The idle nudge now takes idle from the log when it is available, so it no longer relies on the cwd-matched hook.
- Version 1 reads the log tail only; matching queue items to turns is not attempted yet.
- Removed: the cwd-matched hook guess as the first source of an agent's state, wherever the log can be read.

## 0.147.2 - 2026-11-20

- Fix: a GPU agent's call to a store with several matching relay sessions failed with "Several previews match"; the bridge now uses the one with the latest heartbeat.
- A saved update now answers with `resolvedBy` (who has resolved), so "saved" can no longer hide a resolve vote that was not counted.
- Removed: the "Several previews match" dead end.

## 0.147.1 - 2026-11-20

- Fix: a table's Group by and sort choice now survives refresh. The saved key used the table's position among the page's tables, which shifted whenever a table gained or lost rows (tables under three rows are skipped), and `/team` vs `/team.html` counted as different pages. It is now keyed by the table's header text and the normalised path. Choices saved under the old key are not carried over; pick once more.
- Removed: the position index from the saved-choice key, and the separate `.html`/slash variants of one page's saved state.

## 0.147.0 - 2026-11-20

- `<CeremonyRows />`: the daily ceremony as one row per ticket (read-only, build 1). Each row shows the ticket, planned → observed effort, a surprise chip when they differ by one Fibonacci step or more, the owner's note as the observation, a chip per voter (✓ agree, ⚑ challenge, ○ not yet) with challenge lines, and open, challenged or settled. A row is settled when every voter agreed; silence never counts as agree. It reads `ceremony.json` at the site root through the new bridge route `GET /ceremony`; the site manager writes the file. Voting buttons follow in build 2.

## 0.146.0 - 2026-11-20

- Comments and replies now wait in the agent's queue by default (delivered when it is idle). A **⚠ interrupt** box next to Send, or `Ctrl+Shift+Enter`, sends past the queue instead. This inverts the old `Ctrl+Shift+Enter` queue shortcut. An agent's context is a finite budget, so interrupting is opt-in.
- `GET /latency`: minutes each of your messages waited for an answer, and time to resolve, per thread and per addressed agent (medians). For the ceremony's queue-time statistic; queue items for tests need a timestamp from the site manager.
- Removed: the "queued" state as a special case in the help text and message wording; queued is now simply the default.

## 0.145.0 - 2026-11-20

- Idle nudges no longer repeat the same item. Each agent keeps the version it was last nudged about for every thread (last reply or vote) and queue item (state, run, weight); a nudge names the first item not yet named at its current version, so the next one follows. A named item returns only when its version changes, or after 30 minutes once all have been named. A status line `waiting` posted since the last nudge pauses it. (Site manager's proposal, message 4022.)
- Removed: the separate 30-minute pace for queue items, and the thread-first-always rule.

## 0.144.1 - 2026-11-20

- The resolve indicator in the comment list is a coloured pill at the right edge: one dot per participant (filled = resolved, yours is larger), the tally, and "you". Amber while you haven't resolved, green once you have.

## 0.144.0 - 2026-11-20

- Each open thread in the comment list shows your own resolve mark and the tally: `✓ you 2/3` or `○ you 0/2` (hover for who has resolved). Resolved threads keep just "resolved".
- The list reuses `resolveMarks`, the same helper the thread header uses, so the two cannot disagree.

## 0.143.1 - 2026-11-20

- Fixed: `:grep` hits now open at the matching line, not just the page. The jump searched only for the matched word, so it landed on the first occurrence on the page; it now picks the occurrence whose paragraph, list item or table row shares the most words with the hit's source line (also for `:grep -m`).

## 0.143.0 - 2026-11-20

- `<RoomFeed />` shows every mesh room on a page (the Demo /team "Rooms" section): topic, members, open time, the pinned summary and the last 20 posts. It reads the new bridge route `GET /rooms` from the mesh database in read-only mode, so viewing never marks a post read and needs no seat. Open rooms are expanded; closed ones sit behind a "show N closed" toggle.
- Room convention: a post starting `SUMMARY:` is pinned (latest wins); a post starting `CLOSED:` closes the room and sets its close time. The mesh itself has no such fields.
- Removed: two copies of the session-id regex in `server.mjs`; both now use `bareSession` from `src/roster.mjs`.

## 0.142.0 - 2026-11-20

- A page's `voted: true|false` front-matter flag shows on its card as a green "voted ✓" or an orange "not voted" chip (thread aaec5b27: planning vote before a page may start running). ADR only shows it; blocking planned to running is the status generator's job.

## 0.141.0 - 2026-11-20

- A page with `status: todo` (an idea, may be bare) shows a `todo` chip on its card, blue with a ☐ icon, ahead of `planned`.

## 0.140.0 - 2026-11-20

- A page that is done stays done when threads are opened on it later; the card no longer flips it back to review (thread 2367efbc). `openThreads` still counts them and the card still lists who has not resolved. Holding a page out of done while threads are open is for the status generator.

## 0.139.1 - 2026-11-20

- Reads over the mesh no longer time out on long histories (thread bdc6753e, sim agent). The response was sent as many 6 KB chunks, and the mesh allows about nine sends per pair in a short window, so a big read stopped after nine chunks and the reader gave up. Responses are now gzipped and sent in 9 KB chunks (the reader accepts both forms).

## 0.139.0 - 2026-11-20

- Card test rows of planned or running tests show their queue place from the test's `doer`, `rank` and `after`: "queued #13, doer", with ", after id" when it waits, or "not queued: no doer" (thread 2343372b).

## 0.138.0 - 2026-11-20

- A card test may carry `link: "#heading-slug"` (or a site path); the test's name on the card is then a link to its result (thread f7ed1520). Anything else, such as `javascript:` or `//host`, is dropped. Headings use VitePress slugs: lower case, spaces to hyphens, punctuation removed.

## 0.137.0 - 2026-11-20

- `<SplatViewer src="…" />` embeds a Gaussian splat (`.ply`, `.splat`, `.spz`, `.ksplat`) with orbit controls (thread a634e142). It uses Spark and three.js, which install with the plugin and load only on pages that use the component. Needs WebGL2; shows a note where it is missing.

## 0.136.0 - 2026-11-20

- History tabs are now This page, Page history, Open and Resolved. Open lists threads you have not resolved yourself (replacing the short-lived "Not by me" tab). The Chat, All and Notes tabs and their keys are gone; `H` opens Page history.

## 0.135.0 - 2026-11-20

- History tab "Not by me" (key `M`): open threads you have not resolved yourself, so you can leave the others' votes to the nudges.

## 0.134.1 - 2026-11-20

- Thread cards in the history list show their preview as plain text: `**bold**`, `[label](link)`, code and `> ` quote markers lose their markers, where they showed raw before (thread fca02c2d). The open thread itself already rendered them.

## 0.134.0 - 2026-11-19

- The idle nudge is quick: an agent with a thread waiting on it (or needing its resolve vote) is pinged after 10 seconds idle, then at most every 5 minutes; other queue items after 1 minute idle (was 5), then every 30 minutes. After progress the next ping follows as soon as the idle wait has passed. The check runs every 5 seconds (was 60).

## 0.133.0 - 2026-11-19

- **Threads about this page** (thread f379e1a8): the **This page** filter now also lists threads whose text links to the page. `:threads` opens it; in the What's new list (`n`) each page shows `💬 N` open threads and `t` opens the page with them.

## 0.132.1 - 2026-11-19

- A reply sent under a display name ("Site manager") no longer notifies its own sender: the sender is matched by slug too.

## 0.132.0 - 2026-11-19

- The idle nudge drains a backlog: when the agent's open count has shrunk since the last nudge and it is idle again, the next nudge follows after 2 minutes instead of 30, naming the next item. With no progress it stays at one per 30 minutes.

## 0.131.0 - 2026-11-19

- Agents address replies like the user does: `update_doc_review_comment` takes `to` (and `whisper`). Named agents get a mesh note, and a reply to someone who had resolved reopens the thread for them. Without `to`, the thread's current addressees are told, except the sender. This also holds for agents on another machine, over the mesh.

## 0.130.0 - 2026-11-19

- A thread an agent starts with `to`, and an agent's reply in a thread, now send a mesh note to the thread's other addressees (never to the sender), as a user's comment already did. Before, agent-to-agent threads only reached a queue, and nobody was pushed to look.

## 0.129.0 - 2026-11-19

- A thread stays in `threads.json` (and so in an agent's queue) until that agent has **resolved** it, not just answered it. Before, an addressee who had replied dropped out, and the thread never came back to ask for their resolve vote.
- `unanswered_threads` also returns `toResolve`: open threads addressed to you whose last word is an agent's and that you have not resolved. The idle nudge and the team table count them and say "needs your resolve vote".

## 0.128.1 - 2026-11-19

- The plugin's tools load the preview (VitePress) only when a preview starts, so a client machine without `node_modules` can use them over the mesh.

## 0.128.0 - 2026-11-19

- Doc-review tools work from a peer machine over the mesh: a named preview answers `ADR-REQ` messages with chunked `ADR-RES` replies, and with `remote.json` naming the peer, the tools take `store: "demo"` for a store the machine does not run. Text only; images are not carried yet.

## 0.127.0 - 2026-11-19

- Unblock ping: when a page held in review (open thread or missing verdict) loses its last blocker and turns done, its owner gets one mesh note to check it and set it done. Pages held when the preview starts are only recorded, not announced.

## 0.126.0 - 2026-11-19

- Queue events: ADR reads the site's `.queue-events.jsonl` and sends a hand-over note to the doers a finished test unblocks, and an alert to the owner and blocked doers when a test fails or is lost. Replaces the site dispatcher timer.

## 0.125.1 - 2026-11-19

- The resolve chips now sit in the thread's sticky header (beside Resolve / Close for all), so who has resolved stays visible while you scroll.

## 0.125.0 - 2026-11-19

- **Unresolve** takes back only your mark; **Close for all** is its own button (with confirmation).
- A new message addressed to someone who had resolved clears their mark and reopens the thread.
- Images pasted or dropped on an open thread go with the reply being written; replies can carry images, shown in the thread and delivered to agents as files.
- `threads.json` rows carry `unresolved_by`; the page card shows "waiting" with who has not resolved the open threads, for the queue generator to hold the page in their queues.

## 0.124.2 - 2026-11-19

- Fix: the agents' status icons on the To: chips disappeared in 0.124.1, because the resolve chips refreshed the roster with a no-op redraw. Roster refreshes now redraw every waiting row.

## 0.124.1 - 2026-11-19

- Open threads show a row of resolve chips under the state line, one per participant: green ✓ resolved, yellow ○ not resolved, red ✗ not resolved and offline. This replaces relying on the small pie alone.

## 0.124.0 - 2026-11-19

- Resolve is per participant: the user's Resolve is one mark among the addressees', and a thread closes when everyone has resolved. The thread state shows a pie of who has and "waiting on …". **Close for all** (after you have resolved) asks for confirmation and lists the remaining agents with their mesh state. Old log records still close for all on replay.

## 0.123.0 - 2026-11-19

- The verdict is now structured: a front-matter `verdict:` block with `result` (supported | not-supported | inconclusive), `claim` and `confidence` (hypothesis | confirmed). Free text or a `## Verdict` heading no longer satisfies it, and a page that would be done without it is held in `review` with `blockedBy: [verdict]`.

## 0.122.0 - 2026-11-19

- New page status `review` (between running and done), with its own tag colour. A finished page shows it automatically while threads on it are open (from `threads.json`) and returns to done when they are resolved; an explicit `status: review` / `card-status: review` is respected.
- Fewer false "needs verdict" and "missing gist" flags: a front-matter `verdict:` / `learnings:` counts, `## What we learned` and `## Lessons` count as learnings, and a card with no gist falls back to the page's `question:`. On the Demo site this clears 23 of 46 needs-verdict flags and 12 of 58 missing-field flags.

## 0.121.0 - 2026-11-19

- Thread header shows its queue position per addressee (`queue sim-agent: #3 of 8`), or a red `not in X's queue` flag while that agent still owes an answer.

## 0.120.0 - 2026-11-19

- `@name` picker in the comment and reply boxes: arrows/Tab/Enter choose a team name and add that agent to the To: chips (typed `@names` are added on send too).
- Whisper indicator: a reply starting `/w name text` turns the box purple and shows who alone will get it, or an unknown-name warning.

## 0.119.1 - 2026-11-19

- Fix: notes to agents on a peer machine (gpu-agent, sim-agent) now go through the mesh router (`machine` + session id). 0.116.1 addressed them as a `remote:[…]` id, which the mesh rejects as "not active" once its cached row goes stale, so those notes were silently retried and never delivered. The same path carries idle nudges.

## 0.119.0 - 2026-11-19

- Threads as queue input: where `queues.json` exists, the server writes `threads.json` beside it (`[{id, page, addressees, answered_by, at}]`, open threads only, kept current as threads change).
- Per-participant resolve: on a thread with several addressees, an agent's resolve counts only for that agent and the thread closes when every addressee has resolved; the user's Resolve still closes it for everyone. A thread an agent has resolved leaves that agent's unanswered list.

## 0.118.0 - 2026-11-19

- Idle nudge: an agent idle for 5 minutes (`ADR_NUDGE_MINUTES`; `ADR_NUDGE=off` disables) with open queue items or threads waiting on it gets one mesh note naming its next item, then at most one per 30 minutes, never while working. Idle is read from the agent-notify hook or the agent's status line. `/mesh` members carry `open` and `idleMinutes`; the team table shows a red "idle N min with K open" chip.

## 0.117.0 - 2026-11-19

- Unsent comment and reply text survives a refresh or server restart: drafts are saved in `localStorage` (`adr-drafts`) as you type, per page for new comments and per thread for replies, as a ring buffer of the newest 30 for 3 days. Sending clears the draft; reopening the comment box restores it ("Restored your unsent text").

## 0.116.1 - 2026-11-19

- Fix: comment notes to agents on peer machines (for example `gpu`) were sent to the bare session id, which the mesh does not route, so GPU-side agents never received "ADR comment for you" messages. Recipients whose team-table machine is a peer in `machines.json` are now addressed as `remote:["machine","session"]`. Restart the preview server to pick this up.

## 0.116.0 - 2026-11-19

- The team page now shows a task graph (`TaskGraph.vue`, inside `<TeamGraph />`): one lane per agent from `queues.json`, arrows from each item's `after` ids (same page, or `page#id`) to the item that waits, pink for blocked, blue for running. Independent tests are grouped on the left. A dependency missing from the queues counts as done.
- Agents whose queue is `[]` get an orange "queue empty" chip in the live table and a "queue empty" lane, so an agent with no allocated tests is visible instead of absent.

## 0.115.0 - 2026-11-19

- Effort votes: `votes.json` at the site root holds every vote round. `adr-vote [--root DIR] PAGE ITEM AGENT N` casts a vote (Fibonacci 1 2 3 5 8 13 21); `--reveal PAGE ITEM` closes the round and stores mean, variance and whether it converged (max and min within one step), and sets the weight (median, the higher value on an even count) when it did; `--note PAGE ITEM AGENT-or-owner "text"` adds a min/max justification or the owner's reply. `POST /vote` and `GET /votes` do the same for scripts and agents. Votes stay hidden (only who voted) until the round is revealed.
- New `<VoteHistory />` (optionally `page="/path"`): one collapsible row per item with its rounds indented (votes, mean, variance, converged, notes, owner reply), an inline-SVG dot plot of the votes per round, a "rounds needed to decide" bar chart, and 10 items per page. Works on the published site from the baked-in copy.

## 0.114.0 - 2026-11-19

- Team graph: a queue item's `weight` (from `queues.json`) is shown next to its state.

## 0.113.1 - 2026-11-19

- Fix: 0.113.0 shipped with a syntax error in the preview server (it did not start). Use 0.113.1 or later.

## 0.113.0 - 2026-11-19

- Team graph: each node's current task comes from `queues.json` at the site root (`{agent-slug: [{rank, test, page, state, run}]}`): the running item, else the lowest rank. The agent's status ping is only the fallback when its queue is empty. `/mesh` returns `queues`.

## 0.112.1 - 2026-11-19

- Agent names lose accents instead of the letter: "Demo agent" is `demo-agent`, not `m-kki-agent`. The old form is still accepted in `to` lists and comments already addressed to it.

## 0.112.0 - 2026-11-19

- Page front-matter `owner:` is shown on the card and is the default recipient of a new thread on that page (when it names a known recipient, e.g. `pc-lead`; matching ignores case and spaces). `participants:` stay selectable as extra recipients. `/pagelinks` returns `owner` and `partners`.

## 0.111.0 - 2026-11-19

- Mandatory card fields: gist, owner, state. A page with a card that lacks one shows a red "missing: owner" chip on the card and a "card incomplete" chip in the tree.
- New `adr-check <site-root>` command lists such pages and exits 1, for a build or pre-commit hook.

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

- Fix: comment notes to agents are now sent at `high` priority. At `normal` the mesh shows only a 70-character "not urgent" hint, which busy agents skipped, so Alice's replies went unread for hours even though the notes were delivered to their inbox.
- Monitoring: every unexpected server exit (crash, signal, give-up) is also appended to `<state>/<store>.failures.jsonl` (`{at, pid, reason}`), and the watchdog sends a mesh note to the owning agent (the store's session id). A normal stop is not recorded there.
- Fix: a comment or reply to an agent that was not on the mesh at that moment ("Recipient is not active") was dropped, so the agent never woke. The server now retries every minute (up to 6 h) until the note is delivered or the agent has read the thread.
- Fix: the server crashed ("Cannot set properties of undefined (setting 'ready')") when the embedding worker exited while starting.

## 0.68.4 - 2026-11-17

- The page tree shows a hollow ring with a count for pages that have open threads waiting on the agent. Before, only threads with something new for you got a ball, so an unresolved thread you had just replied to showed nothing.

## 0.68.3 - 2026-11-17

- Fix: mesh comment notifications named the addressed agent where the server name belongs (`store="demo-agent"`); they now give the server name (or store id).
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
