---
status: done
title: Embed a Rerun viewer on a page
summary: A page component that plays a .rrd file (timeline, video-like playback) inside the preview, so ML runs can be reviewed and commented on in place.
---

# Rerun embed

Requester: Nicklas (via the mokki agent, 14 Nov), from a comment on `/mlops`.

Mökki will log eval videos (frames over time, predicted and pseudo-label paths, homographies) as Rerun `.rrd` files. We want to view them inside the preview, next to the plan.

Wanted:

1. **Component:** for example `<RerunViewer src="…/x.rrd" height="…" />`, using the hosted web viewer in an iframe (`https://app.rerun.io/version/<VERSION>/?url=<RRD_URL>&theme=dark`) or the npm `@rerun-io/web-viewer`. Local `.rrd` files served from the site's `public/`.
2. **Playback:** timeline scrubbing and play work in the page; the layout fits the wide page style.
3. **Comments:** a comment on the viewer can quote a timestamp (nice to have).

Test file now (public, CORS `*`, 89 MB, driving camera plus LiDAR plus trajectory, close to our data):
`https://app.rerun.io/version/latest/examples/nuscenes_dataset.rrd`

Smaller ones: `detect_and_track_objects.rrd` (4.5 MB), `dna.rrd` (0.5 MB), same base URL.

Mökki side: `/mlops` will embed it once the component exists. Our own `.rrd` from TartanDrive `sam_loop_0` comes from the GPU agent.
