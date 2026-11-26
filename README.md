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
adr <folder> --name demo            # reachable as http://demo.localhost:PORT; `:restart` in the page restarts it
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
whoever launches it (recorded in `<folder>/.adr-data/store`; an earlier server for the folder is adopted automatically). To force one, pass `--store UUID` or put it in `<folder>/.adr-store`. The data itself lives in `<folder>/.adr-data/` (gitignored). Agents read it with `read_doc_review_comments(store=...)`, where the store may be the server name (`demo`), the folder, or the UUID.

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

A node can carry `"code": "repo:path#L12"`. It shows a `</>` badge, and `o` in
visual mode (or a double-click) opens it. A site-root `public/code-repos.json`,
`{"repo": {"local": "/abs/checkout", "github": "https://github.com/o/r", "ref": "main"}}`,
maps the repo. On a localhost preview the click opens ADR's own read-only code
viewer (`/__adr/code/<repo>/<path>#L12`, CodeMirror with Vim keys, `/` search,
"copy vim +line", `:q` back); anywhere else it opens the GitHub blob at `ref`.
The viewer reads only files inside a mapped checkout (no dot-folders, no key or
secret-looking names, 2 MB cap) and only for loopback hosts. After changing
the viewer, run `npm run build:code-viewer`.

**Code map.** `python3 scripts/codemap/codemap.py config.json` builds a nested
graph from git repos (`{"out": "public/graph/codemap.json", "repos": [{"name": "app", "path": "/abs/app"}], "compose": [{"repo": "app", "glob": "compose/*.yaml"}]}`):
repo, folders, files, classes and functions, with every box linked to its
source. Embed it with `<DocGraph src="/graph/codemap.json" />`; Enter or
double-click opens a box, Backspace goes up. `--check` lists files no box points to. The preview rebuilds the map at start when the site has `tools/codemap.json`. `"interfaces": [{"title", "file": "app:path", "match": "regex", "note"}]` adds an Interfaces level whose boxes open the first line matching the regex (a packet format, a port), where the stack meets the outside.

`tools/fetch_arxiv.py <id> --root <docs>` turns an arXiv paper into a
commentable page.

## Experiment gates

`scripts/gates/` holds project-agnostic scripts for a ticket workflow: experiment index, test checks against run data, plan and size checks, vote precision, a ticket graph and a small run catalog. Run them from the site root or set `SITE_ROOT`. Other settings: `EXP_EXTERNAL_DOCS` (optional second docs tree), `EXP_HUMAN` (default `maintainer`), `EXP_SENDER` (default `coordinator`).

The `Check`, `Data`, `Plot`, `Video`, `SyncedRun`, `RunningNow`, `CatalogRuns` and `CatalogServer` components read a catalog from `base` (default `http://127.0.0.1:8766`). `examples/experiments/` shows a static catalog under `public/demo-catalog/`, a vote card and the ticket graph, all synthetic.

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

This repo is public. `git config core.hooksPath .githooks` enables a pre-commit and pre-push check (`tools/leak-guard.sh`) that rejects changes matching the regexes in `~/.config/adr/ignore-terms` (one per line, case-insensitive; kept outside the repo so the list itself is never published; `ADR_IGNORE_TERMS` points elsewhere). It checks diffs, file names, author identity and commit messages. Bypass deliberately with `--no-verify`; the pre-push hook still scans.
