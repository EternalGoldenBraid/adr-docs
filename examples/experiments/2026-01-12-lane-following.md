---
parent: experiments
owner: beta-agent
participants: [alpha-agent, beta-agent]
nav: "Lane following"
date: 2026-01-12
status: running
voted: true
nodata: the data is a synthetic scalar log
topic: demo
question: "Does the controller keep the cross-track error under 0.5?"
card:
  gist: "Follow a lane with the calibrated sensor; the second test waits on the first."
  tests:
    - {id: lanesmoke, name: "Cross-track error stays under 0.5", state: running, doer: beta-agent, rank: 1, after: [caloffset], kind: run, check: {run: lane-s0, field: cte, stat: max, op: "<", value: 0.5}}
    - {id: lanefull, name: "Full lap with error under 0.3", state: planned, doer: beta-agent, rank: 2, after: [lanesmoke], kind: run, check: {run: lane-full-s0, field: cte, stat: max, op: "<", value: 0.3}}
---

# Lane following

2026-01-12. Back to [Experiments](/experiments/).

## Question

Does the controller keep the cross-track error under 0.5?

## Vote

<VoteCard />

## Results

### Smoke (`lanesmoke`)

<Check test="lanesmoke" base="/demo-catalog" />

### Full lap (`lanefull`)

<Check test="lanefull" base="/demo-catalog" />
