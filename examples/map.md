---
card-line: Interactive station-transect map demo
card-status: shipped
card-what: Pan/zoom map with layers and hover thumbnails
card-state: Works on the published site; bags need a server
card-evidence: Demo routes.json, 2 transects
card-next: driverAt takeover colouring
card-owner: ADR
title: Station map
parent: index
---

# Station map

<PageCard />

<PageCard board />

**Synthetic data**, two station transects and three survey recordings, to show the component. Drag to pan, scroll to zoom, click a recording to open it.

<RouteMap src="/routes.json" :height="520" />
