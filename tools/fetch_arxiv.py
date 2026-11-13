#!/usr/bin/env python3
"""Fetch an arXiv HTML paper (e.g. 2211.08416v3) as a commentable page.

Usage: fetch_arxiv.py <arxiv-id> [--root DOCS_DIR]

The page is saved under <root>/public/papers/<id>.html with asset URLs made
absolute, the review script added, and the article marked as the commentable
document. <root>/papers/<id>.md is an empty stub that tells the comment tool
which source the comments belong to. Fetched pages are not redistributable:
keep them out of version control.

If <root>/public/papers/edition.js exists it is added too, and
<root>/editions/<id>.json is copied next to the page for it to load.
"""
import argparse
import os
import re
import shutil
import urllib.request
from urllib.parse import urljoin

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument("arxiv_id")
parser.add_argument("--root", default=".", help="documentation directory (default: current directory)")
args = parser.parse_args()
root = os.path.abspath(args.root)
arxiv_id = args.arxiv_id

base = f"https://arxiv.org/html/{arxiv_id}"
html = urllib.request.urlopen(base, timeout=60).read().decode("utf-8")

html = re.sub(
    r'(src|href|data)="(?!https?:|#|//|data:|mailto:)([^"]+)"',
    lambda m: f'{m.group(1)}="{urljoin(base, m.group(2))}"',
    html,
)
# arXiv's script re-resolves <object> URLs against the wrong origin; <img> renders the same SVG
html = re.sub(r'<object type="image/svg\+xml" data="([^"]+)"([^>]*)></object>', r'<img src="\1"\2>', html)
html = html.replace('<article class="', '<article class="vp-doc ', 1)

scripts = '<script src="/__preview_comments/client.js" defer></script>'
if os.path.exists(os.path.join(root, "public/papers/edition.js")):
    scripts += f'<script src="/papers/edition.js" data-paper="{arxiv_id}" defer></script>'
html = html.replace("</body>", scripts + "</body>", 1)

title = re.search(r"<title>(.*?)</title>", html, re.S).group(1).strip()
os.makedirs(os.path.join(root, "public/papers"), exist_ok=True)
os.makedirs(os.path.join(root, "papers"), exist_ok=True)
with open(os.path.join(root, f"public/papers/{arxiv_id}.html"), "w") as f:
    f.write(html)
edition = os.path.join(root, f"editions/{arxiv_id}.json")
if os.path.exists(edition):
    shutil.copy(edition, os.path.join(root, f"public/papers/{arxiv_id}.edition.json"))
with open(os.path.join(root, f"papers/{arxiv_id}.md"), "w") as f:
    f.write(f"# {title}\n")
print("ok:", title)
print(f"open /papers/{arxiv_id}.html in the review preview")
