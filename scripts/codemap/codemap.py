#!/usr/bin/env python3
"""Generate a nested DocGraph JSON ("code map") from one or more git repositories.

    codemap.py config.json            write the graph named in the config
    codemap.py config.json --check    list tracked files that no box points to

Config:
    {"out": "public/graph/codemap.json",
     "repos": [{"name": "app", "path": "/abs/path/to/app"}],
     "compose": [{"repo": "app", "glob": "compose/*.yaml"}],
     "links": [{"from": "app:pkg/link.py", "to": "app:tools/bridge.py", "label": "UDP 5600"}]}

Levels (each box opens the graph one level down with Enter or double click):
    top -> machines and containers (compose) | ROS nodes and topics | one folder tree per repo
    folder -> files and folders -> Python file -> classes and functions -> methods
Every box has a `code` link "<repo>:<path>#L<line>", so each repo needs an entry in
public/code-repos.json for the source viewer.
"""
import ast
import json
import math
import re
import subprocess
import sys
from pathlib import Path

COL = {
    "repo": ("#1e3a8a", "#60a5fa"),
    "dir": ("#172554", "#3b82f6"),
    "file": ("#1e293b", "#64748b"),
    "class": ("#3b0764", "#a855f7"),
    "func": ("#052e16", "#22c55e"),
    "machine": ("#431407", "#fb923c"),
    "service": ("#451a03", "#f59e0b"),
    "ros": ("#042f2e", "#2dd4bf"),
    "top": ("#0f172a", "#e2e8f0"),
}


class Graph:
    def __init__(self):
        self.nodes, self.edges, self.ids = [], [], set()
        self.by_inside = {}

    def add(self, nid, title, kind, inside=None, body="", code=""):
        assert nid not in self.ids, nid
        self.ids.add(nid)
        fill, stroke = COL[kind]
        node = {"id": nid, "title": title, "body": body, "status": "", "kind": "node", "parent": None,
                "inside": inside, "topics": [], "x": 0, "y": 0, "w": max(200, min(420, 9 * len(title) + 40)), "h": 70,
                "fill": fill, "stroke": stroke, "font": "#e5e7eb", **({"code": code} if code else {})}
        self.nodes.append(node)
        self.by_inside.setdefault(inside, []).append(node)
        return nid

    def edge(self, a, b, label="", color="#94a3b8"):
        self.edges.append({"id": f"e{len(self.edges)}", "source": a, "target": b, "color": color,
                           "dashed": False, "label": label})


def tracked(path):
    out = subprocess.run(["git", "-C", str(path), "ls-files", "-co", "--exclude-standard"], capture_output=True, text=True)
    if out.returncode == 0 and out.stdout.strip():
        return sorted(out.stdout.splitlines())
    return sorted(str(p.relative_to(path)) for p in Path(path).rglob("*") if p.is_file() and ".git" not in p.parts)


def parse(src):
    try:
        return ast.parse(src)
    except (SyntaxError, ValueError):
        return None


def py_symbols(tree):
    out = []
    for n in tree.body:
        if isinstance(n, ast.ClassDef):
            out.append(("class", n.name, n.lineno, [(m.name, m.lineno) for m in n.body if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef))]))
        elif isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
            out.append(("func", n.name, n.lineno, []))
    return out


def topics_of(tree):
    """(publishes, subscribes) as {topic: line} from create_publisher / create_subscription string literals."""
    pubs, subs = {}, {}
    for n in ast.walk(tree):
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr in ("create_publisher", "create_subscription"):
            strs = [a.value for a in n.args[:3] if isinstance(a, ast.Constant) and isinstance(a.value, str)]
            if strs:
                (pubs if n.func.attr == "create_publisher" else subs).setdefault(strs[0].lstrip("/"), n.lineno)
    return pubs, subs


def grid(nodes):
    cols = max(1, math.ceil(math.sqrt(len(nodes) * 1.8)))
    cw = max(x["w"] for x in nodes) + 40
    for i, x in enumerate(nodes):
        x["x"], x["y"] = (i % cols) * cw, (i // cols) * 110


def columns(nodes, edges):
    """Left-to-right flow: rank by longest path with back edges (cycles) ignored, so a loop does not push everything right."""
    ids = [n["id"] for n in nodes]
    out = {i: [] for i in ids}
    for e in edges:
        if e["source"] != e["target"]:
            out[e["source"]].append(e["target"])
    state, back = {}, set()

    def visit(u):
        state[u] = 1
        for v in out[u]:
            if state.get(v) == 1:
                back.add((u, v))
            elif v not in state:
                visit(v)
        state[u] = 2

    indeg = {i: 0 for i in ids}
    for u in ids:
        for v in out[u]:
            indeg[v] += 1
    for u in sorted(ids, key=lambda i: indeg[i]):
        if u not in state:
            visit(u)
    rank = {i: 0 for i in ids}
    for _ in range(len(ids)):
        moved = False
        for u in ids:
            for v in out[u]:
                if (u, v) not in back and rank[v] < rank[u] + 1:
                    rank[v] = rank[u] + 1
                    moved = True
        if not moved:
            break
    rows = {}
    for n in nodes:
        r = rank[n["id"]]
        n["x"], n["y"] = r * 520, rows.get(r, 0) * 120
        rows[r] = rows.get(r, 0) + 1
    for r, count in rows.items():
        for n in nodes:
            if rank[n["id"]] == r:
                n["y"] -= (count - 1) * 60


def file_tree(g, repo, root, files, top):
    dirs = {"": top}
    trees = {}
    for f in files:
        parts = f.split("/")
        for i in range(1, len(parts)):
            d = "/".join(parts[:i])
            if d not in dirs:
                dirs[d] = g.add(f"{repo}:dir:{d}", parts[i - 1] + "/", "dir", dirs["/".join(parts[:i - 1])], body=d, code=f"{repo}:{d}")
        nid = g.add(f"{repo}:file:{f}", parts[-1], "file", dirs["/".join(parts[:-1])], body=f, code=f"{repo}:{f}")
        if f.endswith(".py"):
            try:
                tree = parse((root / f).read_text(errors="replace"))
            except OSError:
                tree = None
            if tree:
                trees[f] = tree
                for kind, name, line, methods in py_symbols(tree):
                    sid = g.add(f"{repo}:sym:{f}:{name}", name + ("()" if kind == "func" else ""), kind, nid, body=f"{f}:{line}", code=f"{repo}:{f}#L{line}")
                    for m, ml in methods:
                        g.add(f"{repo}:sym:{f}:{name}.{m}", m + "()", "func", sid, body=f"{f}:{ml}", code=f"{repo}:{f}#L{ml}")
    return trees


def compose_layer(g, cfg, repos, top):
    """One box per compose file (a machine or stack), each opening its services; edges to the module a service runs."""
    for spec in cfg.get("compose", []):
        repo = repos[spec["repo"]]
        for f in sorted(repo["root"].glob(spec["glob"])):
            rel = str(f.relative_to(repo["root"]))
            lines = f.read_text(errors="replace").splitlines()
            mid = g.add(f"mach:{spec['repo']}:{rel}", f.stem, "machine", top, body=rel, code=f"{spec['repo']}:{rel}")
            starts, inside = [], False
            for i, line in enumerate(lines, 1):
                if re.match(r"^services:\s*$", line):
                    inside = True
                elif inside and re.match(r"^\S", line):
                    inside = False
                m = re.match(r"^  ([A-Za-z0-9_.-]+):\s*$", line) if inside else None
                if m:
                    starts.append((m.group(1), i))
            for k, (name, line) in enumerate(starts):
                end = starts[k + 1][1] - 1 if k + 1 < len(starts) else len(lines)
                sid = g.add(f"svc:{rel}:{name}", name, "service", mid, body=f"service in {rel}", code=f"{spec['repo']}:{rel}#L{line}")
                text = "\n".join(l for l in lines[line - 1:end] if not l.lstrip().startswith("#"))
                runs = [m.replace(".", "/") + ".py" for m in re.findall(r"-m\s+([\w.]+)", text)] + re.findall(r"[\w./-]+\.py", text)
                hit = next((f2 for r in runs for f2 in repo["files"] if f2 == r or f2.endswith("/" + r.lstrip("./"))), None)
                if hit:
                    g.nodes[-1]["code"] = f"{spec['repo']}:{hit}"
                    g.nodes[-1]["body"] = f"service in {rel}:{line}\nruns {hit}"
            kids = g.by_inside.get(mid)
            if kids:
                grid(kids)


def ros_layer(g, cfg, repos, trees, top):
    found = {}
    for rname in repos:
        for f, tree in trees[rname].items():
            pubs, subs = topics_of(tree)
            if pubs or subs:
                line = min(list(pubs.values()) + list(subs.values()))
                found[(rname, f)] = (pubs, subs, g.add(f"ros:{rname}:{f}", Path(f).stem, "ros", top, body=f"{f}\npublishes {len(pubs)}, subscribes {len(subs)}", code=f"{rname}:{f}#L{line}"))
    for link in cfg.get("links", []):
        for end in ("from", "to"):
            repo, f = link[end].split(":", 1)
            if (repo, f) not in found:
                found[(repo, f)] = ({}, {}, g.add(f"ros:{repo}:{f}", Path(f).stem, "ros", top, body=f"{f}\nnot a ROS node", code=f"{repo}:{f}"))
    pair = {}
    for a, (pubs, _, ida) in found.items():
        for t in pubs:
            for b, (_, subs, idb) in found.items():
                if t in subs and a != b:
                    pair.setdefault((ida, idb), []).append("/" + t)
    for link in cfg.get("links", []):
        pair.setdefault((found[tuple(link["from"].split(":", 1))][2], found[tuple(link["to"].split(":", 1))][2]), []).append(link["label"])
    first = len(g.edges)
    for (ida, idb), topics in pair.items():
        label = ", ".join(topics[:2]) + (f" +{len(topics) - 2}" if len(topics) > 2 else "")
        g.edge(ida, idb, label, "#2dd4bf")
    if found:
        columns(g.by_inside[top], g.edges[first:])


def build(cfg):
    g = Graph()
    repos, trees = {}, {}
    for r in cfg["repos"]:
        root = Path(r["path"]).expanduser()
        repos[r["name"]] = {"root": root, "files": tracked(root)}
    mach = g.add("L:mach", "Machines and containers", "top", None, body="compose services; one box per compose file")
    ros = g.add("L:ros", "ROS nodes and topics", "top", None, body="modules that publish or subscribe; edges are topics")
    for name, repo in repos.items():
        rid = g.add(f"L:repo:{name}", name, "repo", None, body=f"{len(repo['files'])} tracked files", code=name + ":")
        trees[name] = file_tree(g, name, repo["root"], repo["files"], rid)
    compose_layer(g, cfg, repos, mach)
    ros_layer(g, cfg, repos, trees, ros)
    for empty in (mach, ros):
        if not g.by_inside.get(empty):
            g.nodes = [n for n in g.nodes if n["id"] != empty]
            g.by_inside[None] = [n for n in g.by_inside[None] if n["id"] != empty]
    for inside, kids in g.by_inside.items():
        if inside == ros or not kids or any(k["x"] or k["y"] for k in kids[1:]):
            continue
        grid(kids)
    return {"nodes": g.nodes, "edges": g.edges}, repos


def unreferenced(graph, repos):
    pointed = {n["code"].split("#")[0] for n in graph["nodes"] if n.get("code")}
    return [f"{name}:{f}" for name, repo in repos.items() for f in repo["files"] if f"{name}:{f}" not in pointed]


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    cfg = json.loads(Path(argv[1]).read_text())
    graph, repos = build(cfg)
    out = Path(cfg["out"]).expanduser()
    if "--check" in argv:
        old = json.loads(out.read_text()) if out.exists() else {"nodes": []}
        missing = unreferenced(old, repos)
        print("\n".join(missing) if missing else f"ok: all {sum(len(r['files']) for r in repos.values())} files are reachable")
        return 1 if missing else 0
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(graph, indent=1))
    miss = unreferenced(graph, repos)
    print(f"{out}: {len(graph['nodes'])} boxes, {len(graph['edges'])} edges, {len(miss)} unreferenced files")
    return 1 if miss else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
