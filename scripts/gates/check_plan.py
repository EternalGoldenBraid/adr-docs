#!/usr/bin/env python3
"""Check the plan: page tree (front matter `parent:`), node links, and cycles.

Cycles inside a graph are normal (the review loop). Cycles in the page tree or
in the node-link structure between pages are errors.
"""
import json, re, subprocess, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
pages = {p.stem: p for p in root.glob("*.md")}
errors = []


def front(path):
    m = re.match(r"---\n(.*?)\n---", path.read_text(), re.S)
    return dict(l.split(":", 1) for l in m.group(1).splitlines() if ":" in l) if m else {}


def find_cycle(edges):
    state, stack = {}, []

    def dfs(n):
        state[n] = 1
        stack.append(n)
        for m in edges.get(n, []):
            if state.get(m) == 1:
                return stack[stack.index(m):] + [m]
            if m not in state:
                c = dfs(m)
                if c:
                    return c
        stack.pop()
        state[n] = 2
        return None

    for n in list(edges):
        if n not in state:
            c = dfs(n)
            if c:
                return c
    return None


parents = {}
for name, path in pages.items():
    par = front(path).get("parent", "").strip()
    if par:
        parents[name] = par
        if par not in pages:
            errors.append(f"{name}: parent '{par}' is not a page")
cycle = find_cycle({k: [v] for k, v in parents.items()})
if cycle:
    errors.append("page tree cycle: " + " > ".join(cycle))

links, inner = {}, {}
for gp in sorted((root / "public" / "graph").glob("*.json")):
    g = json.loads(gp.read_text())
    ids = {n["id"] for n in g["nodes"]}
    adj = {}
    for e in g["edges"]:
        for end in (e["source"], e["target"]):
            if end not in ids:
                errors.append(f"{gp.name}: edge {e['id']} references missing node {end}")
        adj.setdefault(e["source"], []).append(e["target"])
    c = find_cycle(adj)
    if c:
        inner[gp.name] = c
    owner = next((n for n, p in pages.items() if f"/graph/{gp.name}" in p.read_text()), None)
    for n in g["nodes"]:
        t = n.get("link", "").strip("/")
        if t:
            if t not in pages and not (root / (t + ".md")).exists():
                errors.append(f"{gp.name}: node {n['id']} links to missing page '{t}'")
            elif owner:
                links.setdefault(owner, []).append(t)
cycle = find_cycle(links)
if cycle:
    errors.append("page link cycle: " + " > ".join(cycle))

for k, c in inner.items():
    print(f"info: {k} has a cycle (ok inside a graph): {' > '.join(c)}")
tracked = subprocess.run(["git", "ls-files"], cwd=root, capture_output=True, text=True).stdout.split()
for f in tracked:
    fp = root / f
    if fp.is_file() and fp.stat().st_size > 50 * 1024:
        print(f"warn: {f} is {fp.stat().st_size // 1024} KB; files over 50 KB go to a release")
print(f"{len(pages)} pages, {len(parents)} with a parent")
for e in errors:
    print("ERROR", e)
sys.exit(1 if errors else 0)
