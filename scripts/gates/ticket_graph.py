#!/usr/bin/env python3
"""Write public/graph/tickets.json: the open tests of every ticket, with what blocks them.

A lane per ticket, a node per test (doer and state in the body), an edge per `after`.
A test is blocked when a test it waits on is not done. Only tickets with a running or
review test, or with an `after` link, are shown. Use --check to fail when the file is out of date.
"""
import os
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(os.environ.get("SITE_ROOT", ".")).resolve()
OUT = ROOT / "public" / "graph" / "tickets.json"
PRESENT = ROOT / "public" / "graph" / "tickets-present.json"
OPEN = ROOT / "public" / "graph" / "tickets-open.json"
CLOSED = ("done", "obsolete")
COLORS = {"blocked": "#f87171", "running": "#fb923c", "review": "#a3e635", "planned": "#38bdf8", "todo": "#94a3b8"}
W, H, GAP = 260, 150, 40


def tests_of(path):
    m = re.match(r"---\n(.*?)\n---\n", path.read_text(), re.S)
    fm = (yaml.safe_load(m.group(1)) or {}) if m else {}
    return fm.get("nav") or path.stem, (fm.get("card") or {}).get("tests") or []


def build():
    tickets = {p.stem: tests_of(p) for p in sorted((ROOT / "experiments").glob("*.md"))}
    state = {}
    for stem, (_, tests) in tickets.items():
        for t in tests:
            state[f"{stem}/{t['id']}"] = t.get("state", "")
    owner = {}
    for key in state:
        owner.setdefault(key.split("/", 1)[1], key)

    def resolve(stem, ref):
        return ref if "/" in ref else f"{stem}/{ref}" if f"{stem}/{ref}" in state else owner.get(ref)

    linked = {resolve(stem, a) for stem, (_, tests) in tickets.items() for t in tests for a in t.get("after") or []}
    nodes, edges, y = [], [], 0
    blocked = 0
    for stem, (nav, tests) in tickets.items():
        open_tests = [t for t in tests if t.get("state") not in CLOSED]
        if not any(t.get("state") in ("running", "review") or t.get("after") or f"{stem}/{t['id']}" in linked for t in open_tests):
            continue
        nodes.append({"id": stem, "kind": "lane", "title": nav, "body": "", "status": "", "parent": None,
                      "x": 0, "y": y, "w": GAP + len(open_tests) * (W + GAP), "h": H + 2 * GAP + 20,
                      "fill": "#0f172a", "stroke": "#475569", "font": "#f8fafc"})
        for i, t in enumerate(sorted(open_tests, key=lambda t: t.get("rank", 99))):
            key = f"{stem}/{t['id']}"
            waits = [r for r in (resolve(stem, a) for a in t.get("after") or []) if r and state.get(r) not in CLOSED]
            st = "blocked" if waits else t.get("state", "todo")
            blocked += bool(waits)
            for n, r in enumerate(resolve(stem, a) for a in t.get("after") or []):
                if r in state:
                    edges.append({"id": f"{key}<{r}", "source": r, "target": key, "color": "#94a3b8",
                                  "dashed": state.get(r) in CLOSED, "label": ""})
            nodes.append({"id": key, "kind": "node", "title": t["id"],
                          "body": f"{t.get('doer', '?')}, {st}\n{str(t.get('name', '')).split(':')[0]}", "status": "",
                          "parent": stem, "x": GAP + i * (W + GAP), "y": y + GAP + 20, "w": W, "h": H,
                          "fill": "#1e293b", "stroke": COLORS.get(st, "#94a3b8"), "font": "#f8fafc"})
        y += H + 3 * GAP + 20
    ids = {n["id"] for n in nodes}
    edges = [e for e in edges if e["source"] in ids and e["target"] in ids]
    stats = {"tickets": sum(n["kind"] == "lane" for n in nodes), "tests": sum(n["kind"] == "node" for n in nodes),
             "edges": len(edges), "blocked": blocked}
    return {"nodes": nodes, "edges": edges}, stats


def present(open_all=False):
    """One node per running or review ticket, plus the tickets it waits on or blocks; an edge per cross-ticket `after`."""
    info = {}
    for p in sorted((ROOT / "experiments").glob("*.md")):
        m = re.match(r"---\n(.*?)\n---\n", p.read_text(), re.S)
        fm = (yaml.safe_load(m.group(1)) or {}) if m else {}
        info[p.stem] = fm
    owner = {t["id"]: stem for stem, fm in info.items() for t in (fm.get("card") or {}).get("tests") or []}
    pairs = set()
    for stem, fm in info.items():
        for t in (fm.get("card") or {}).get("tests") or []:
            for a in t.get("after") or []:
                dep = a.split("/")[0] if "/" in a else owner.get(a)
                if dep and dep != stem and dep in info:
                    pairs.add((dep, stem))
    now = {s for s, fm in info.items() if fm.get("status") in (("todo", "planned", "running", "review") if open_all else ("running", "review"))}
    keep = now | {x for pair in pairs if now & set(pair) for x in pair}
    keep = {s for s in keep if info[s].get("status") not in ("done", "abandoned") or s in now}
    colors = {"running": "#fb923c", "review": "#a3e635", "planned": "#38bdf8", "todo": "#94a3b8"}
    nodes = []
    for i, s in enumerate(sorted(keep)):
        fm = info[s]
        nodes.append({"id": s, "kind": "node", "title": fm.get("nav") or s, "body": str(fm.get("status", "")),
                      "status": "", "parent": None, "x": (i % 3) * (W + GAP), "y": (i // 3) * (H + GAP),
                      "w": W, "h": H, "fill": "#1e293b", "stroke": colors.get(fm.get("status"), "#94a3b8"), "font": "#f8fafc"})
    edges = [{"id": f"{a}<{b}", "source": a, "target": b, "color": "#94a3b8", "dashed": False, "label": ""}
             for a, b in sorted(pairs) if a in keep and b in keep]
    return "{\n\"nodes\":[\n" + ",\n".join(json.dumps(n) for n in nodes) + "\n],\n\"edges\":[\n" + \
        ",\n".join(json.dumps(e) for e in edges) + "\n]\n}\n", len(nodes), len(edges)


def main():
    graph, stats = build()
    text = "{\n\"nodes\":[\n" + ",\n".join(json.dumps(n) for n in graph["nodes"]) + "\n],\n\"edges\":[\n" + \
        ",\n".join(json.dumps(e) for e in graph["edges"]) + "\n]\n}\n"
    ptext, pn, pe = present()
    otext, on, oe = present(True)
    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text() != text or not PRESENT.exists() or PRESENT.read_text() != ptext or not OPEN.exists() or OPEN.read_text() != otext:
            print("public/graph/tickets.json is stale: run scripts/gates/ticket_graph.py")
            return 1
        return 0
    OUT.write_text(text)
    PRESENT.write_text(ptext)
    OPEN.write_text(otext)
    print(json.dumps(stats), {"present tickets": pn, "present edges": pe, "open tickets": on, "open edges": oe})
    return 0


if __name__ == "__main__":
    sys.exit(main())
