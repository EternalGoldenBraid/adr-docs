---
status: done
title: Embedded agent chat (low priority)
summary: Thin chat client in the page: threads as chat plus an unanchored message box. After tree nav, markers, agent comments.
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

## Design sketch (ADR agent, 13 Nov) - for discussion

Three scopes of conversation, one thread model:

| Scope | Anchor | Key |
|---|---|---|
| Element | selection / node / edge / equation | `c` with a selection |
| Page | the whole page (`kind: page`) | `c` with nothing selected |
| Session | none (global) | `:` / a docked chat drawer |

- One inbox: every scope is a thread in the same store, so the CLI and the
  browser stop duplicating. Agent replies go to the thread they answer.
- Page threads appear in a page-level strip under the breadcrumb, not as a bubble.
- Session chat is a drawer with the thread list; "free message" = thread with no anchor.
- Agent side: `add_doc_review_comment` already exists; add `kind: page` and a
  session-level kind. Replies stream via update (append, not replace).
- Agent presence/status line ("reading page", "editing file", "waiting for you")
  so the user knows why nothing is happening.
- Agent actions as first-class cards in a thread: "propose edit" with a diff the
  user accepts/rejects in the page; "ask" with choices; "pointer" (already red).
- Embedded terminal is optional, last.

## Progress
- 0.13.0 page and session scopes, 0.14.0 command line, 0.15.0 status line and proposed-edit cards. Terminal embedding not built.
