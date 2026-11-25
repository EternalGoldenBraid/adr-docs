#!/usr/bin/env python3
"""Print one line for each run that has landed in the catalog since the last call.

A run has landed when its manifest carries a headline number. Reads the catalog service
over ssh (no tunnel needed) and remembers what it reported in ~/.local/state/adr-gates/catalog-notify.json.

  python3 scripts/gates/catalog_notify.py [--host HOST] [--port 8766] [--peek]

Output: "<experiment>/<run> landed: <name> <value> <unit>; <link>". The site manager sends
each line to the participants of the experiment's page. --peek lists without remembering.
"""
import argparse
import json
import subprocess
from pathlib import Path

STATE = Path.home() / ".local/state/adr-gates/catalog-notify.json"


def fetch(host, port):
    out = subprocess.run(["ssh", host, f"curl -sf localhost:{port}/runs"], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def line(m, port):
    h = m["headline"]
    link = f"http://127.0.0.1:{port}/runs/{m['experiment']}/{m['run']}/run.rrd"
    return f"{m['experiment']}/{m['run']} landed: {h['name']} {h['value']} {h.get('unit', '')}".rstrip() + f"; {link}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--host", default="localhost")
    ap.add_argument("--port", type=int, default=8766)
    ap.add_argument("--peek", action="store_true")
    args = ap.parse_args()
    seen = set(json.loads(STATE.read_text())) if STATE.exists() else set()
    new = [m for m in fetch(args.host, args.port) if "headline" in m and f"{m['experiment']}/{m['run']}" not in seen]
    for m in new:
        print(line(m, args.port))
    if new and not args.peek:
        STATE.parent.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps(sorted(seen | {f"{m['experiment']}/{m['run']}" for m in new})))


if __name__ == "__main__":
    main()
