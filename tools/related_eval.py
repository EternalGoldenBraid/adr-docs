"""Offline test of "smart linking": given a comment thread, which pages does it relate to?

Ground truth: pages that an agent linked in its replies in the thread (markdown links to site pages), minus the page the thread is on.
Query: the thread's first comment. Candidates: the site's pages. Scorers: TF-IDF (baseline) and bge-small embeddings (fastembed, CPU).
Reports precision@3, recall@3 and hit@3, and how precision changes with a similarity threshold.

  uv run --with scikit-learn --with fastembed python tools/related_eval.py <site-root> [--no-embed]
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

root = Path(sys.argv[1]).expanduser()
use_embed = "--no-embed" not in sys.argv


def page_slug(path: Path) -> str:
    return path.relative_to(root).with_suffix("").as_posix().removesuffix("/index")


pages = {}
for path in root.rglob("*.md"):
    parts = path.relative_to(root).parts
    if any(p.startswith(".") or p in ("node_modules", "workstreams") for p in parts):
        continue
    text = path.read_text(errors="ignore")
    pages[page_slug(path)] = re.sub(r"^---\n.*?\n---\n", "", text, flags=re.S)[:6000]

threads = {}
replies = defaultdict(list)
for line in (root / ".adr-data" / "comments.jsonl").read_text().splitlines():
    r = json.loads(line)
    if r.get("commentId"):
        replies[r["commentId"]].append(r)
    elif r.get("comment") and not r.get("removed"):
        threads[r["id"]] = r

LINK = re.compile(r"\]\(\s*(?:https?://[^/)]+)?/?(?:\./)?([\w./-]+?)(?:\.html|\.md)?(?:#[^)]*)?\)")
cases = []
for tid, t in threads.items():
    here = re.sub(r"^/|\.html$", "", re.sub(r"https?://[^/]+", "", t["url"]).split("#")[0]) or "index"
    truth = set()
    for r in replies[tid]:
        if r.get("author") != "user":
            for m in LINK.findall(r.get("reply") or ""):
                slug = m.strip("/").removesuffix("/index")
                if slug in pages and slug != here:
                    truth.add(slug)
    if truth:
        cases.append((tid, t["comment"], truth, here))
print(f"{len(pages)} pages, {len(threads)} threads, {len(cases)} threads with linked pages")
if not cases:
    sys.exit("no ground truth")

slugs = list(pages)
queries = [c[1] for c in cases]


def scores_tfidf():
    from sklearn.feature_extraction.text import TfidfVectorizer
    vec = TfidfVectorizer(sublinear_tf=True, stop_words="english", ngram_range=(1, 2), min_df=1)
    matrix = vec.fit_transform([slug.replace("-", " ") + " " + pages[slug] for slug in slugs] + queries)
    docs, qs = matrix[: len(slugs)], matrix[len(slugs):]
    return (qs @ docs.T).toarray()


def scores_embed():
    from fastembed import TextEmbedding
    model = TextEmbedding("BAAI/bge-small-en-v1.5")
    d = np.array(list(model.embed([f"{s.replace('-', ' ')}. {pages[s][:1500]}" for s in slugs])))
    q = np.array(list(model.embed(queries)))
    return q @ d.T


def report(name, scores):
    p3, r3, hit = [], [], []
    for i, (_, _, truth, here) in enumerate(cases):
        s = scores[i].copy()
        if here in slugs:
            s[slugs.index(here)] = -1
        top = [slugs[j] for j in np.argsort(-s)[:3]]
        got = len(truth & set(top))
        p3.append(got / 3); r3.append(got / len(truth)); hit.append(got > 0)
    print(f"{name:8s} precision@3 {np.mean(p3):.2f}  recall@3 {np.mean(r3):.2f}  hit@3 {np.mean(hit):.2f}")
    flat = []
    for i, (_, _, truth, here) in enumerate(cases):
        for j in np.argsort(-scores[i])[:3]:
            if slugs[j] != here:
                flat.append((scores[i][j], slugs[j] in truth))
    flat.sort(reverse=True)
    for q in (0.25, 0.5, 0.75):
        k = max(1, int(len(flat) * q))
        sub = flat[:k]
        print(f"   top {int(q * 100):3d}% of suggestions (score >= {sub[-1][0]:.2f}): precision {np.mean([ok for _, ok in sub]):.2f} ({k} links)")


report("tfidf", scores_tfidf())
if use_embed:
    report("bge", scores_embed())
