---
status: accepted
title: Agent attention beacon and "go to agent" navigation
summary: Wherever the user is, show that an agent comment awaits them and make jumping to it one key.
---

# Agent attention beacon

Requester: Nicklas (via the mokki agent, 13 Nov).

Agents can now leave red comments (0.10.0). The user should clearly see that
an agent is asking for attention, wherever they are, and the platform should
make it easy to come to the agent.

Wanted:

- A persistent indicator, visible on every page, when any agent thread awaits
  the user: a count and a red state on the Comments button, and the tab title.
- Awaiting threads on other pages are included, not only the current page.
- One key (Vim `]` / `[`, or a button) to jump to the next awaiting thread,
  across pages: navigate, scroll to the anchor, open the thread.
- The tree popover and breadcrumb mark pages that have awaiting threads.
- A thread stops awaiting when the user replies or resolves it.

Open: whether "awaiting" means every unresolved agent-authored thread or only
those the agent flags as needing an answer.

## Plan
- (Done in 0.16.0: awaiting counts, tab title, tree markers. Remaining: jump key, live tree refresh.)
- "Awaiting" = unresolved thread whose last message is from the agent (root included); replying or resolving clears it.
- Also: live page-tree refresh (watch the markdown files, reload `/tree.json`) so new pages need no restart.
