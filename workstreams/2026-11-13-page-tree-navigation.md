---
status: done
title: Page tree navigation
summary: parent/order front matter, breadcrumbs, child list, collapsible tree, tree.json; works in static build.
---

# Page tree navigation (hierarchy instead of a flat top bar)

Requester: Nicklas (via the mokki agent, 13 Nov).

The top bar lists every top-level `.md` file and cannot keep growing. The plan
is becoming a tree: Plan (graph) → Autonomy → Pixel lock, with more pages
under each.

Ask:

- Optional front matter `parent: <page-slug>` (default: top level). Pages with
  no parent are the only ones in the top bar; the bar stays short.
- Every page shows a breadcrumb (Plan › Autonomy › Pixel lock) and a list of its
  child pages, so one can descend and climb without the bar.
- A collapsible tree (sidebar or popover) of all pages, current page
  highlighted. Vim: a key to open it, `j/k` to move, Enter to go.
- `nav:` still sets the label. Order by front matter `order:` then title.
- Agent-friendly: also write the tree as a machine-readable list (for example
  `tree.json` or a generated `index` listing) so an agent can see the plan's
  structure without opening every file.
- Works with the static build (GitHub Pages example) as well as the preview.

Related: DocGraph node links (2026-11-13-docgraph-links.md). A node that opens
a child page should match the page tree; consider letting the graph link and
`parent:` reference the same slug.

Mokki pages today: index (Graph), autonomy, pixel-lock, literature,
meeting-notes. Intended tree: index › autonomy › pixel-lock; literature and
meeting-notes under index.
