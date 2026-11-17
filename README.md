# Agent Doc Review

Read Markdown, equations, arXiv papers and graphs in your browser, and comment
on anything. A GitHub Copilot CLI session reads the comments and replies.

**[Live demo](https://eternalgoldenbraid.github.io/agent-doc-review/)**
· or locally with `npm run readme`. The hosted demo is static, so comments need the local preview.

## Quick start

Needs Node.js 20+.

```bash
npm ci
npm run readme                       # the landing page, with a graph demo
npm run preview -- path/to/doc.md    # any Markdown file
npm run export -- doc.md --page /x   # offline copy of one page; repeat --page for several (or the Export button / :export)
adr path/to/doc.md 5190              # same, from anywhere (ln -s $PWD/bin/preview.mjs ~/.local/bin/adr)
adr path/to/site --port 5174         # a whole folder of pages, from its index.md
adr path/to/site -d                  # run in the background (log in the state dir)
adr list                             # running ADR servers: url, pid, store, folder
adr keep <dir> --port N --name NAME  # mark a server persistent (start it now, restart it whenever it is down)
adr unkeep <name|store>              # stop keeping it
adr daemon install                   # once: systemd --user unit that starts kept servers at login and after crashes
adr tui                              # dark terminal list: j/k, r restart/start, x stop, o open, q quit
adr <folder> --name demo            # reachable as http://demo.localhost:PORT; `:restart` in the page restarts it
npm run example:paper                # fetch an arXiv paper for the example
```

Open the printed `127.0.0.1` link. Viewing needs no agent. Comments are saved
to disk and wait until an agent reads them. Comments addressed to agents that are
online reach them over the agent mesh without an agent hosting the preview.

Each served page or folder has its own comment store, printed at startup. To keep
one store for a site whoever launches it, put its UUID in `<folder>/.adr-store`,
or pass `--store UUID`. Agents read it with `read_doc_review_comments(store=...)`.

`adr list` shows every running server and its store, and clears stale entries. Browsers
refuse some ports (for example 6666, the IRC range); `adr` rejects those with a message.
Agents can call `list_doc_review_servers` for the same list.

## With Copilot CLI

Needs Copilot CLI with extensions (`/experimental`). Run `npm ci` first.

```bash
copilot --plugin-dir "$(pwd)"
```

Then ask: `Use the document-review skill to review /absolute/path/to/doc.md`.

| Tool | Purpose |
| --- | --- |
| `start_doc_review` | Start the preview for an absolute `document_path`. It ends with the session; for a durable named server use `adr . -d --name <name> --store <session id>`. |
| `read_doc_review_comments` | Fetch unread threads (`include_seen` for all). |
| `update_doc_review_comment` | Reply and/or resolve a thread; optional `proposal` (before/after) posts a diff card inside the thread. |
| `stop_doc_review` | Close the preview; comments are kept. |

Reading or replying never resolves a thread; only you do.

## Commenting

Select text, or click an equation, figure, graph node or edge, and choose
**Comment here**. **History** lists threads, replies and Resolve/Reopen. Press `s` and drag
to attach a screenshot of a region to a comment or thread (one-time "share
this tab" prompt).

## Graphs

`<DocGraph src="/graph/example.json" />` renders an editable, layered graph from
a JSON file in the document's `public/` folder. Press `?` for controls. Normal
mode pans and zooms; edit mode moves and edits nodes; Vim keys work throughout.
See `examples/public/graph/example.json` for the format.

`tools/fetch_arxiv.py <id> --root <docs>` turns an arXiv paper into a
commentable page.

## Notes

- The server binds to `127.0.0.1` only. Nothing is sent to an external service;
  comments the agent reads become part of that conversation.
- Comments live in `~/.local/state/agent-doc-review/` (or `$XDG_STATE_HOME`).
  Don't publish them.
- The renderer is standalone VitePress; it ignores your own VitePress config.
- Tests: `npm test`. Integrating into an existing VitePress site:
  [docs/preview-comments.md](docs/preview-comments.md).

## License

MIT
