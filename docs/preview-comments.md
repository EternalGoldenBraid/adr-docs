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

**History** lists this session's saved comments. Filter by **All comments**,
**Unresolved**, or **Resolved**, then open a thread to see its selected-content
snapshot, page link, and dated replies from you and Copilot.

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
document position; the **Vim** button shows **NORMAL**, **VISUAL**, or **COMMENT**
mode. Click it to turn keyboard controls off or on. The preference is saved for
the preview origin. The open history panel shows **HISTORY**. Textareas use
native input.

| Keys | Action |
| --- | --- |
| `h` / `l`, `j` / `k` | Move by character or rendered line. |
| `w` / `b`, `0` / `$` | Move to word or rendered-line boundaries. |
| `gg` / `G` | Move to the document start or end. |
| `L` / `H` | Move to the top or bottom of the visible document. |
| `v` | Enter visual selection; motions extend the selection. Press again to return to normal mode. |
| `c` in visual mode, or `-c` | Open a comment on the selection. `-c` also resumes an unsent draft. |
| `-h` | Open comment history. |
| `Space` inside a caveat | Open or close its details. |
| `Esc` | Leave visual mode or close a panel, preserving drafts. |

The leader is `-`. Word and line motions use the browser's text-selection
boundaries. Navigation stays inside the article; it does not edit the document.
Textareas and other form controls retain their native input behavior, as do
modified browser shortcuts. Mouse selection and equation/figure commenting
remain available. A browser without `Selection.modify` reports that keyboard
selection is unsupported.

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
