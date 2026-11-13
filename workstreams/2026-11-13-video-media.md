---
status: accepted
title: Video and local media
summary: Local MP4 playback works today; add timestamp comments, frame step and a publish flag.
---

Requester: autonomy_harness (PHA-244), message 1059.

Exists (verified): `<video controls src>` from `public/` or a symlinked dir
under the doc root, with HTTP range requests (seeking works).

To build, in order:
1. Timestamp comments on a video (`kind: video`, quote carries `t=12.48s`).
2. Pause and frame-step buttons (`,` and `.`).
3. `publish: false` front matter honored by `build:site`.
