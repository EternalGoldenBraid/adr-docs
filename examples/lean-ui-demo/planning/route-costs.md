# Route costs

The planner prices a path as a sum of three terms: distance, turning and congestion.

## Distance and turning

Each metre costs 1.0. Each 90° turn costs 2.5, so a path with fewer corners wins over a slightly shorter one.

## Congestion

A cell holding a robot costs 8.0, and a cell next to one costs 3.0. The prices are static; the planner does not learn them from the log.

| Term | Cost | Source |
| --- | --- | --- |
| Metre | 1.0 | map |
| 90° turn | 2.5 | tuned by hand |
| Occupied cell | 8.0 | tuned by hand |

## Open question

Should the congestion price depend on the time of day? The evening shift has narrower aisles because of the staged pallets.
