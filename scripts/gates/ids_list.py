#!/usr/bin/env python3
"""Write public/ids.json: test ids and agent names for the reply-box suggestions.

Each entry: {id, kind: test|agent, page (ticket stem), name}. Tests come from the
`card.tests` of every experiments page; agents from `doer` and `participants`.
Use --check to fail when the file is out of date.
"""
import os
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(os.environ.get("SITE_ROOT", ".")).resolve()
OUT = ROOT / "public" / "ids.json"


def front(path):
    m = re.match(r"---\n(.*?)\n---\n", path.read_text(), re.S)
    return (yaml.safe_load(m.group(1)) or {}) if m else {}


def build():
    ids, agents = [], set()
    for p in sorted((ROOT / "experiments").glob("*.md")):
        fm = front(p)
        card = fm.get("card") or {}
        agents.update(fm.get("participants") or [])
        for t in card.get("tests") or []:
            if not t.get("id"):
                continue
            agents.add(t.get("doer"))
            ids.append({
                "id": t["id"], "kind": "test", "page": p.stem,
                "name": str(t.get("name", "")).split(":")[0],
            })
    ids += [{"id": a, "kind": "agent"} for a in sorted(x for x in agents if x)]
    return ids


def main():
    text = "[\n" + ",\n".join(json.dumps(i) for i in build()) + "\n]\n"
    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text() != text:
            print("public/ids.json is stale: run scripts/gates/ids_list.py")
            return 1
        return 0
    OUT.write_text(text)
    print(f"{len(json.loads(text))} ids written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
