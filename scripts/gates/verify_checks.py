#!/usr/bin/env python3
"""Tick card tests whose data condition holds, from the runs in the catalog.

A test may carry a check:
  check: {experiment: <id, default the page's name>, run: <optional run name>, field: pose_err_m, stat: min, op: "<", value: 0.1}
When a run of that experiment has finished (manifest progress phase "done"), the
stat of the field over its tick lines in scalars.jsonl is compared with the value.
The test becomes state done with `measured` and `result: pass|fail` (a fail means
measured, not met). The latest finished run counts; one run is one seed, so a pass
is a reading to review, not a verdict.

  python3 scripts/gates/verify_checks.py [--host HOST] [--port 8766] [--dry] [--watch 5]

A test of kind video with `video: {run, file?}` ticks when that run's manifest lists a video item.

A page's `data: <experiment>/<run>` that is not in the catalog is reported too.

Prints one line per test it ticked, for the doer.
"""
import argparse
import json
import operator
import re
import statistics
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import exp_index  # noqa: E402

STATS = {"min": min, "max": max, "last": lambda v: v[-1], "median": statistics.median, "mean": statistics.fmean}
OPS = {"<": operator.lt, "<=": operator.le, ">": operator.gt, ">=": operator.ge}


def get(host, port, path):
    out = subprocess.run(["ssh", host, f"curl -sf localhost:{port}{path}"], capture_output=True, text=True, check=True)
    return out.stdout


def tick(path, test_id, measured, result):
    text = path.read_text()
    pat = re.compile(rf"^(\s*- \{{id: {re.escape(test_id)},.*?)state: (?:planned|running)(.*?)\}}\s*$", re.M)
    new, n = pat.subn(rf"\1state: done\2, measured: {measured}, result: {result}}}", text, count=1)
    if n:
        path.write_text(new)
    return bool(n)


def tick_video(path, test_id):
    pat = re.compile(rf"^(\s*- \{{id: {re.escape(test_id)},.*?)state: (?:planned|running)(.*?\}})\s*$", re.M)
    new, n = pat.subn(r"\1state: done\2", text := path.read_text(), count=1)
    if n:
        path.write_text(new)
    return bool(n)


def verify(host, port, dry):
    runs = json.loads(get(host, port, "/runs"))
    known = {f"{m['experiment']}/{m['run']}" for m in runs}
    for page in exp_index.card_pages():
        d = exp_index.front(page).get("data")
        if d and d not in known:
            print(f"{page.stem}: data '{d}' is not in the catalog; the ticket cannot be done until it resolves", flush=True)
        for t in exp_index.card_tests(page) or []:
            v = t.get("video")
            if v and t.get("state") in ("planned", "running"):
                exp = v.get("experiment", page.stem)
                for m in runs:
                    if m["experiment"] == exp and m["run"] == v["run"] and any(
                            i.get("kind") == "video" and v.get("file", i["file"]) == i["file"] for i in m.get("items", [])):
                        if dry or tick_video(page, t["id"]):
                            print(f"{page.stem}/{t['id']}: run {m['run']} reported a video; doer {t.get('doer')}", flush=True)
                        break
                continue
            c = t.get("check")
            if not c or t.get("state") not in ("planned", "running"):
                continue
            exp = c.get("experiment", page.stem)
            done = [m for m in runs if m["experiment"] == exp and m.get("progress", {}).get("phase") == "done" and c.get("run", m["run"]) == m["run"]]
            if not done:
                continue
            m = done[0]
            lines = get(host, port, f"/runs/{exp}/{m['run']}/scalars.jsonl").splitlines()
            vals = [r[c["field"]] for r in map(json.loads, lines) if r.get("kind") == "tick" and c["field"] in r]
            if not vals:
                continue
            measured = round(STATS[c["stat"]](vals), 4)
            result = "pass" if OPS[c["op"]](measured, c["value"]) else "fail"
            if dry or tick(page, t["id"], measured, result):
                print(f"{page.stem}/{t['id']}: {c['stat']} {c['field']} = {measured} {c['op']} {c['value']}: {result} (run {m['run']}, one seed); doer {t.get('doer')}", flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--host", default="localhost")
    ap.add_argument("--port", type=int, default=8766)
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--watch", type=int, metavar="SECONDS", help="keep checking every SECONDS until interrupted")
    args = ap.parse_args()
    while True:
        verify(args.host, args.port, args.dry)
        if not args.watch:
            break
        time.sleep(args.watch)


if __name__ == "__main__":
    main()
