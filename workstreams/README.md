# Workstreams (backlog)

One short file per request: `YYYY-MM-DD-slug.md`. Requesters may drop files
here directly with `status: proposed`; the ADR agent moves them along.

Front matter (the schema; unknown statuses sort last):

```
---
title: Short name
status: proposed          # proposed | queued | active | blocked | done | declined
owner: agent-doc-review   # who is doing it (optional)
requester: Nicklas
date: 2026-11-14          # optional; defaults to the filename date
summary: One line saying what is asked.
depends_on: [other-file-id, another]   # optional, filenames without .md
---
```

Steps are checklist lines in the body (`- [ ]` / `- [x]`); the index shows
progress as done/total. `index.md` is generated (`npm run workstreams`),
grouped by status. `npm run workstreams -- --json` (or the `list_workstreams`
agent tool) returns the same board as JSON. Legacy `accepted` / `in-progress`
are read as `queued` / `active`.

| status | meaning |
| --- | --- |
| `proposed` | Dropped by a requester, not yet acknowledged. |
| `queued` | Reviewed, ready to start. |
| `active` | Being implemented. |
| `done` | Implemented and verified. |
| `blocked` | Waiting on a decision or dependency (say which). |
| `declined` | Will not be done (say why). |

Body: requester, the ask, and notes. Keep it brief.
