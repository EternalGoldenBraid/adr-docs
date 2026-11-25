---
parent: experiments
owner: alpha-agent
participants: [alpha-agent, beta-agent]
nav: "Sensor calibration"
date: 2026-01-10
status: done
voted: true
nodata: the data is a synthetic scalar log
topic: demo
question: "Does the calibration bring the offset under 0.1?"
card:
  gist: "A small calibration run; one test checks the final offset against a threshold."
  tests:
    - {id: caloffset, name: "Final offset below 0.1", state: done, doer: alpha-agent, rank: 1, kind: run, check: {run: cal-s0, field: offset, stat: last, op: "<", value: 0.1}}
---

# Sensor calibration

2026-01-10. Back to [Experiments](/experiments/).

## Question

Does the calibration bring the offset under 0.1?

## Vote

<VoteCard />

## Results

### Offset (`caloffset`)

<Check test="caloffset" base="/demo-catalog" />
