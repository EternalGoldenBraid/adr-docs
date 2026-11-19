---
card-line: Interactive route map demo
card-status: shipped
card-what: Pan/zoom map with layers and hover thumbnails
card-state: Works on the published site; bags need a server
card-evidence: Demo routes.json, 2 routes
card-next: driverAt takeover colouring
card-owner: ADR
title: Route map
parent: index
---

# Route map

<PageCard />

<PageCard board />

Synthetic data, to show the component. Drag to pan, scroll to zoom, click a recording to open it.

<RouteMap src="/routes.json" :height="520" />
