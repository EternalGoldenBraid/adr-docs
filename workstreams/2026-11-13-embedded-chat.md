---
status: proposed
---

# Embedded agent chat in the page (idea, low priority)

Requester: Nicklas (via the mokki agent, 13 Nov), as a comment with a region
screenshot.

Question: what is the CLI for once comments flow through the page? Could the
agent conversation be embedded in the page itself?

Notes from the mokki agent:

- Today comments are the page's input channel; the CLI session is where the
  agent runs, edits files and calls tools. Commenting already covers "ask about
  this spot"; the CLI covers everything else (edit files, run builds).
- An embedded panel would be a thin client: send a message to the attached agent
  session and show its reply, next to the comment threads. It does not replace
  the agent process; it needs a way to push messages into the session (the same
  channel comments use) and to stream replies back.
- Cheapest first step: let a comment thread act as the chat (replies already
  exist), plus a "free message" box not anchored to any element.
- Fun, not urgent. Do after the tree navigation, markers and agent-authored
  comments.
