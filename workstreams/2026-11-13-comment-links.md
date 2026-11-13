---
status: done
title: Links between comments
summary: Let a comment reference another thread, so a page-level discussion can point at the exact node or text thread it is about and be jumped to.
---

# Links between comments

Requester: Nicklas (via the mokki agent, 13 Nov).

A node thread sometimes turns into a page-level discussion. The reply then
belongs on the page, but the reader must still be able to reach the original
thread. Likewise, a page-level comment may summarise several node threads.

Wanted:

- A comment can reference another thread. The reference renders as a link
  showing the target's anchor and first words.
- Following the link navigates to the target page, scrolls to its anchor and
  opens the thread, as the attention-beacon jump does.
- The target shows its backlinks, so both directions can be followed.
- Agents can create references through `add_doc_review_comment` and
  `update_doc_review_comment` (for example a `refs` list of comment ids).

Open: whether references are typed in the text (for example `#<thread id>`)
or chosen from a picker; whether backlinks appear in the thread header or the
page-level panel.
