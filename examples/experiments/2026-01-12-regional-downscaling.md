---
parent: experiments
owner: beta-agent
participants: [alpha-agent, beta-agent]
nav: "Regional downscaling"
date: 2026-01-12
status: running
voted: true
nodata: the data is a synthetic scalar log
topic: demo
question: "Does the downscaled temperature field keep the RMSE against stations under 0.5 °C?"
card:
  gist: "Downscale a coarse climate model to station scale using the bias-corrected stations; the second test waits on the first."
  tests:
    - {id: dsmoke, name: "RMSE against stations stays under 0.5 °C", state: running, doer: beta-agent, rank: 1, after: [biasfit], kind: run, check: {run: ds-s0, field: rmse, stat: max, op: "<", value: 0.5}}
    - {id: dsfull, name: "Full year with RMSE under 0.3 °C", state: planned, doer: beta-agent, rank: 2, after: [dsmoke], kind: run, check: {run: ds-full-s0, field: rmse, stat: max, op: "<", value: 0.3}}
---

# Regional downscaling

2026-01-12. Back to [Experiments](/experiments/).

## Question

Does the downscaled temperature field keep the RMSE against stations under 0.5 °C?

## Vote

<VoteCard />

## Results

### One month (`dsmoke`)

<Check test="dsmoke" base="/demo-catalog" />

### Full year (`dsfull`)

<Check test="dsfull" base="/demo-catalog" />
