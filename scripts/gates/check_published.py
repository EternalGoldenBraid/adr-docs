#!/usr/bin/env python3
"""Fail when a page points at /data/... that CI cannot get.

public/data is gitignored, so CI only has what media.json lists (scripts/gates/media.py pull).
Every /data/... path used in a page or graph must be in media.json, and the local copy,
if present, must match the uploaded checksum (otherwise run scripts/gates/media.py push).
"""
import os
import hashlib, json, re, sys
from pathlib import Path

ROOT = Path(os.environ.get("SITE_ROOT", ".")).resolve()
SKIP = {"node_modules", ".adr", ".git", ".vitepress", ".adr-data", "cache", "attic"}  # .adr-data: ADR's gitignored snapshots, never published
REF = re.compile(r"""["'(=\s](/data/[\w./@+-]+\.\w+)""")
LOCAL_ONLY = (".rrd", ".db")  # never uploaded; the catalog is not published yet
SUFFIXES = {".md", ".vue", ".json", ".ts", ".js"}

manifest = json.loads((ROOT / "media.json").read_text())
refs = {}
for path in ROOT.rglob("*"):
    if path.suffix not in SUFFIXES or not path.is_file() or SKIP & set(path.relative_to(ROOT).parts):
        continue
    if path.name == "media.json" or path.relative_to(ROOT).parts[0] in {"public"} and path.suffix == ".js":
        continue
    for ref in REF.findall(path.read_text(errors="ignore")):
        refs.setdefault(ref.lstrip("/"), path.relative_to(ROOT).as_posix())

errors = []
for rel, page in sorted(refs.items()):
    if rel.endswith(LOCAL_ONLY) or rel.startswith("data/catalog/"):
        continue
    if rel not in manifest:
        errors.append(f"{rel} (used in {page}) is not in media.json")
        continue
    local = ROOT / "public" / rel
    if local.exists() and hashlib.sha256(local.read_bytes()).hexdigest() != manifest[rel]["sha256"]:
        errors.append(f"{rel} changed locally since upload")
if errors:
    print("error: the published site would miss or mismatch media; run python3 scripts/gates/media.py push:\n  " + "\n  ".join(errors))
    sys.exit(1)
