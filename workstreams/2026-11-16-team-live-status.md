---
title: Live team status on the Team page
status: active
owner: agent-doc-review
requester: Nicklas (mokki planner; .dotfiles session)
date: 2026-11-16
summary: Show what each agent is doing now: heartbeat dots, STATUS lines, Refresh/ping, shared read-only state.
depends_on: []
---

# Live team status

Part shipped in 0.58.0: STATUS lines, edges and the hot-corner peek (`-m`). Remaining: Refresh/`:ping`, optional timer, shared JSON file.

- Reachability dot per roster row from the mesh heartbeat (live < 2 min, stale, stopped, unreachable).
- Ping asks for `STATUS <ticket|-> | <running|idle|blocked|waiting> | <doing, ≤12 words> | <next|->`; show the latest reply per agent with its age; ticket id links to its workstream.
- `:ping` / Refresh status button; optional timer. Replies stored in the doc-review state.
- From the .dotfiles Quickshell mesh panel: expose per-agent state (working/waiting/asking/idle) and current task title as a small read-only JSON file, so the desktop panel and ADR share it. Also a mesh-graph view (who talks to whom) like that panel's.
