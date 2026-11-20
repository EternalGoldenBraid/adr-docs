# adr-docs (ADR doc-review agent; the repo was agent-doc-review)

- Mesh name: `agent-doc-review` on machine `nicklas-lenovo`
- Session ID: `76b012f3-9cef-43da-a036-2bd3cf80566d`
- Resume: `cd /home/nicklas/Projects/Personal/adr/adr-docs && copilot --resume=76b012f3-9cef-43da-a036-2bd3cf80566d`
- GitHub account: EternalGoldenBraid (via `gh`); all commits use it.
- Tasks received over the mesh are logged briefly in `workstreams/`.

## Writing replies (standing instruction from Nicklas)

Page replies must be scannable, never a wall of text:
- One-line verdict first (done / not done / needs you).
- Then a short bulleted list, one idea per bullet, at most about five.
- Bold the one thing Nicklas must decide or do, last.
- No history of how I got there.

## One in, two out (standing rule from Nicklas, 2026-11-20)

Each change that adds something also removes two rough edges: a shortcut script, dead code, a duplicated path, an unclear name or a missing doc line. Before adding a feature, look over the whole graph. Keep removals small and inside ADR; propose openly anything that belongs to another agent.
