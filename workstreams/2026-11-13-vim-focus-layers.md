---
status: done
title: Vim focus layers
summary: Page keys by default; graph keys only after click/Enter; Esc climbs back; mode line shows layer.
---

# Vim focus layers: page first, graph on click, Esc climbs back

Requester: Nicklas (via the mokki agent, 13 Nov), reply on a comment on
pixel-lock.

Observed: Vim mode is not respected in layers. The page starts with DocGraph's
keys already active, so `j/k` etc. act on the graph instead of the page.

Wanted:

- Default layer is the **page**: Vim-style navigation scrolls the document
  (`j/k`, `gg/G`, `Ctrl-d/u`, `/` search if feasible).
- Clicking into a graph (or Enter on a focused graph) enters the **graph
  layer**: graph keys (node-to-node motion, flying, insert/visual modes) apply
  and the page keys do not.
- `Esc` in normal mode leaves the graph layer and returns to the page layer.
  Insert mode's `Esc` returns to normal first; a second `Esc` climbs.
- Show the current layer in the mode line (for example `PAGE` vs `GRAPH --
  NORMAL --`), so it is obvious which layer owns the keys.
- Several graphs on one page: only the clicked/focused one is active.
- Comment panel typing must stay isolated (already fixed in 0.6.0).

The same layering should extend to the page tree navigation and any future
embedded widget.
