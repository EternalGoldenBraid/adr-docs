"""Node catalogue: every node of every hand-made graph once, with its code link and its owner.
  python3 scripts/gates/node_catalogue.py           write public/node-catalogue.json and print the counts
  python3 scripts/gates/node_catalogue.py --check   list the nodes with neither a code link nor the no code mark
  python3 scripts/gates/node_catalogue.py --runner  list the items it would queue: one per graph and page owner
  python3 scripts/gates/node_catalogue.py --runner --queue   queue them through exp_index.py --ask; a graph already asked is skipped
A node has code when it carries code or ref; it is a concept on purpose when it carries concept or nocode.
The code map graph is skipped: its nodes are the code itself. Lanes and text boxes are not nodes of the model."""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

root = Path(os.environ.get("SITE_ROOT", ".")).resolve()
SKIP_GRAPHS = {"codemap"}
KEPT = ("id", "page", "ref", "state")  # the file stays under the size limit; owner and title are read from the page and graph
SKIP_KINDS = {"lane", "text", "dot"}
SKIP_DIRS = {"node_modules", "trash", "dist", ".adr-data", ".playwright-mcp", ".git"}


def owners():
    """Graph name -> (page stem, owner), from the DocGraph tags and the page front matter."""
    found = {}
    pages = [p for p in sorted(root.glob("**/*.md")) if not set(p.relative_to(root).parts) & SKIP_DIRS]
    for page in pages:
        text = page.read_text()
        owner = re.search(r"^owner:\s*(\S+)", text, re.M)
        for name in re.findall(r'<DocGraph[^>]*?src="/graph/([^"]+)\.json"', text, re.S):
            found.setdefault(name, (page.stem, owner.group(1) if owner else ""))
    return found


def catalogue():
    who = owners()
    entries = []
    for f in sorted((root / "public" / "graph").glob("*.json")):
        if f.stem in SKIP_GRAPHS:
            continue
        for n in json.loads(f.read_text()).get("nodes", []):
            if n.get("kind") in SKIP_KINDS:
                continue
            page, owner = who.get(f.stem, ("", ""))
            ref = n.get("ref") or n.get("code") or ""
            mark = bool(n.get("concept") or n.get("nocode"))
            entries.append({"id": f"{f.stem}:{n['id']}", "page": page, "ref": ref,
                            "state": "ref" if ref else "no code" if mark else "neither", "owner": owner, "title": n.get("title", "")})
    return entries


def runner(entries, queue):
    gaps = {}
    for e in entries:
        if e["state"] == "neither":
            gaps.setdefault((e["id"].split(":")[0], e["page"], e["owner"]), []).append(e["id"].split(":")[1])
    for (graph, page, owner), nodes in sorted(gaps.items()):
        text = f"{graph}: give {len(nodes)} graph nodes a code ref or the no code mark ({', '.join(nodes[:6])}{', ...' if len(nodes) > 6 else ''})"
        if not owner or not page:
            print(f"no owner: {text} (page {page or '-'})")
            continue
        asked = "ask" + re.sub(r"\W", "", text.lower())[:12]
        card = root / "experiments" / f"{page}.md"
        if card.exists() and f"id: {asked}," in card.read_text():
            print(f"already asked: {graph}")
        elif queue:
            subprocess.run([sys.executable, str(Path(__file__).parent / "exp_index.py"), "--ask", owner, text, page, "--from", os.environ.get("EXP_SENDER", "coordinator")], check=True)
        else:
            print(f"would ask {owner} on {page}: {text}")


if __name__ == "__main__":
    entries = catalogue()
    neither = [e for e in entries if e["state"] == "neither"]
    if "--runner" in sys.argv:
        runner(entries, "--queue" in sys.argv)
    elif "--check" in sys.argv:
        for e in neither:
            print(f"{e['id']}\t{e['owner'] or '-'}\t{e['page'] or '-'}\t{e['title']}")
    else:
        (root / "public" / "node-catalogue.json").write_text("[\n" + ",\n".join(json.dumps({k: e[k] for k in KEPT}) for e in entries) + "\n]\n")
        mapped = {n["id"] for n in json.loads((root / "public" / "graph" / "codemap.json").read_text())["nodes"]}
        stale = [e["id"] for e in entries if e["ref"] and ":" not in e["ref"].split("#")[0].split("/")[0] and e["ref"] not in mapped]
        print(f"{len(entries)} nodes: {sum(e['state'] == 'ref' for e in entries)} with a ref, "
              f"{sum(e['state'] == 'no code' for e in entries)} marked no code, {len(neither)} neither, "
              f"{len(stale)} refs the code map no longer has")
