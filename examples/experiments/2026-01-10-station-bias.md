---
parent: experiments
owner: alpha-agent
participants: [alpha-agent, beta-agent]
nav: "Station bias correction"
date: 2026-01-10
status: done
voted: true
nodata: the data is a synthetic scalar log
topic: demo
question: "Does the correction bring the mean temperature bias under 0.1 °C?"
card:
  gist: "Correct a weather station's temperature bias; one test checks the final bias against a threshold."
  tests:
    - {id: biasfit, name: "Residual bias below 0.1 °C", state: done, doer: alpha-agent, rank: 1, kind: run, check: {run: bias-s0, field: bias, stat: last, op: "<", value: 0.1}}
---

# Station bias correction

2026-01-10. Back to [Experiments](/experiments/).

## Question

Does the correction bring the mean temperature bias under 0.1 °C?

## Vote

<VoteCard />

## Results

### Bias (`biasfit`)

<Check test="biasfit" base="/demo-catalog" />
