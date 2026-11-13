---
status: done
owner: agent-doc-review
title: Workstream files as a native, queryable part of the platform
summary: Workstream tickets render as pages, follow one front-matter schema, and can be listed and queried (status, owner, steps) without reading prose.
---

# Native workstream files

Requester: Nicklas (via the mokki agent, 14 Nov), from a comment on `/mlops` (Tickets).

Mökki uses `workstreams/*.md` as its tickets, as this repo does. They should be native to the platform, so information can be extracted from them easily.

Wanted:

1. **One schema in front matter:** `title`, `status` (proposed, queued, active, blocked, done), `owner`, `summary`, optional `depends_on`, `requester`, `date`.
2. **Steps as checklist items:** `- [ ]` / `- [x]` lines, so progress can be counted.
3. **Rendered in the site:** each file opens as a page, and a Workstreams index page lists them as a table or board grouped by status.
4. **Extractable:** a tool (CLI and agent tool) returns the front matter and step progress as JSON, so agents can read the board without parsing prose.
5. **Linked:** `depends_on` and links from pages show as graph edges or backlinks.

Mökki will follow the schema once it exists; the existing ADR files already use `status`, `title`, `summary`.

Open: whether the status lives in front matter only, or is also editable from the browser.
