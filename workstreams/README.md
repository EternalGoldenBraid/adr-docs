# Workstreams (backlog)

One short file per request: `YYYY-MM-DD-slug.md`. Requesters may drop files
here directly with `status: proposed`; the ADR agent moves them along.

Front matter:

```
---
status: proposed
title: Short name
summary: One line saying what is asked.
---
```

`index.md` is generated from this front matter (`npm run workstreams`) and is
what the preview shows; open it with `npm run preview -- workstreams/index.md`
to browse and comment on the backlog.

| status | meaning |
| --- | --- |
| `proposed` | Dropped by a requester, not yet acknowledged. |
| `accepted` | Reviewed by the ADR agent, ready to start. |
| `in-progress` | Being implemented. |
| `done` | Implemented and verified. |
| `blocked` | Waiting on a decision or dependency (say which). |
| `declined` | Will not be done (say why). |

Body: requester, the ask, and notes. Keep it brief.
