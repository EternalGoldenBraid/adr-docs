---
name: document-review
description: Review Markdown, mathematical explanations and figures in a live local browser with persistent comments attached to the current Copilot CLI session.
---

# Document review

1. For a review that should outlive this session (a team site, a shared store),
   start a named standalone server from the shell: `adr . -d --name <name> --store <session id>`.
   It restarts after a crash and logs why it stopped. Otherwise call `start_doc_review` with the original absolute Markdown path. Choose a focused
   documentation directory: its parent is the served document root.
2. Open the returned URL in the user's shared browser without replacing or
   closing unrelated tabs. The preview updates when the original source changes.
3. Inspect the rendered equations, figures, spacing, contrast and links. A local
   preview is not evidence of GitHub rendering; inspect the publication renderer
   separately before claiming a published visual result.
4. Fetch feedback with `read_doc_review_comments` when relevant. Count-only
   attention does not load comment bodies; reading does not resolve threads.
5. Make scoped edits to the original source and reinspect the rendered result.
   Reply with `update_doc_review_comment`. Resolve explicitly only with the
   user's authorization; replies alone leave status unchanged.
6. Call `stop_doc_review` when the review is finished. This preserves the saved
   history. Do not remove feedback or connection files as general cleanup.

The plugin uses a local loopback bridge and the current Copilot session. Agent
mesh, ROS, Docker and GPU resources are not required. Installing a plugin does
not authorize publishing documents, making remote repositories or pushing code.
