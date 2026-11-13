---
status: done
title: Selection tool
summary: `s` region screenshot attached to comments/threads (done in 0.6.0, unpushed).
---
# Selection tool (region-select attach)

- From: Nicklas via autonomy_harness (mokki comment 1e17970f)
- Ask: key `s` enters region-select; dragged rectangle crop is attached as an image to the comment and delivered to the agent. With a thread selected and its text box inactive, `s` attaches the crop to that thread. Document in `:help`/man page. Reference: Zotero area annotation.
- Open question (unanswered by Nicklas): capture via getDisplayMedia + crop (exact pixels, one-time prompt) vs html2canvas (no prompt, poor for iframes/Cytoscape). Suggested: getDisplayMedia.
- Constraint: no push to main without Nicklas's say-so.
- Status: done in 0.6.0 (committed locally, not pushed). Verified in isolated Chromium with fake tab capture.
