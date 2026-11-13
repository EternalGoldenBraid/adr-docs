---
status: done
title: Links highlight and scroll to their target on landing
summary: When a link lands on a heading, node, or comment, scroll it into view and briefly highlight it so the reader sees what to look at.
---

# Link landing highlight

Requester: Nicklas (via the mokki agent, 14 Nov), from a comment on `/mlops` ("pass bar").

Today a link to `/page#anchor` or to a graph node lands without any cue. Wanted:

1. **In view:** after navigation, scroll the target into view (not hidden under the nav bar), also when the page was already open.
2. **Highlight:** briefly mark the target (for example a 2 s outline or background fade) so the viewer knows where to look.
3. **Targets:** headings and anchors, graph nodes (`/page#node-<id>`), and text passages. Same behaviour for links from comments.
4. **Respect reduced motion:** fade only, no animation, when the user prefers it.

Open: whether graph links should also zoom the camera to the node.
