# Agent Doc Review

Read Markdown, equations, arXiv papers and graphs in your browser, and comment
on anything. A GitHub Copilot CLI session reads the comments and replies.

**[Live demo](https://eternalgoldenbraid.github.io/adr-docs/)**
· or locally with `npm run readme`. The hosted demo is static, so comments need the local preview.

## Quick start

Needs Node.js 20+.

```bash
npm ci
npm run readme                       # the landing page, with a graph demo
npm run preview -- path/to/doc.md    # any Markdown file
npm run export -- doc.md --page /x   # offline copy of one page; repeat --page for several (or the Export button / :export)
npm run export -- site/index.md --serve   # whole site + public/ assets + serve.py, for pages that fetch files at run time
adr path/to/doc.md 5190              # same, from anywhere (needs the symlink below)
adr path/to/site --port 5174         # a whole folder of pages, from its index.md
adr path/to/site -d                  # run in the background (log in the state dir)
adr list                             # running ADR servers: url, pid, store, folder
adr keep <dir> --port N --name NAME  # mark a server persistent (start it now, restart it whenever it is down)
adr unkeep <name|store>              # stop keeping it
adr daemon install                   # once: systemd --user unit that starts kept servers at login and after crashes
adr tui                              # dark terminal list: j/k, r restart/start, x stop, o open, q quit
adr <folder> --name mokki            # reachable as http://mokki.localhost:PORT; `:restart` in the page restarts it
npm run example:paper                # fetch an arXiv paper for the example
```

The `adr` command is not installed by `npm ci`: link it once, and again if the checkout moves (a stale link gives `adr: command not found`):

```bash
ln -sfn "$PWD/bin/preview.mjs" ~/.local/bin/adr   # run in the adr-docs checkout; ~/.local/bin must be on PATH
```

Open the printed `127.0.0.1` link. Viewing needs no agent. Comments are saved
to disk and wait until an agent reads them. Comments addressed to agents that are
online reach them over the agent mesh without an agent hosting the preview.

Each served page or folder has its own comment store, printed at startup. A folder keeps its store
whoever launches it (recorded in `<folder>/.adr-data/store`; an earlier server for the folder is adopted automatically). To force one, pass `--store UUID` or put it in `<folder>/.adr-store`. The data itself lives in `<folder>/.adr-data/` (gitignored). Agents read it with `read_doc_review_comments(store=...)`, where the store may be the server name (`mokki`), the folder, or the UUID.

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
| `unanswered_threads` | Read-only check for a natural pause: open threads whose last word is the user's, with age and quote; always prints the count ("checked: 0 unanswered"). |
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
- Standalone servers keep comments in `<site>/.adr-data-data/`; agent-session servers and runtime files use `~/.local/state/agent-doc-review/` (or `$XDG_STATE_HOME`).
  Don't publish them.
- The renderer is standalone VitePress; it ignores your own VitePress config.
- Tests: `npm test`. Integrating into an existing VitePress site:
  [docs/preview-comments.md](docs/preview-comments.md).

## License

MIT

## Keeping private strings out

This repo is public. `git config core.hooksPath .githooks` enables a pre-commit and pre-push check (`tools/leak-guard.sh`) that rejects changes matching the regexes in `~/.config/adr/denylist` (one per line, case-insensitive; kept outside the repo so the list itself is never published). Bypass deliberately with `--no-verify`; the pre-push hook still scans.
