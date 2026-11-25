#!/usr/bin/env python3
"""Files under public/data live in a GitHub release, not in git (the folder is gitignored).

  media.py push   upload new or changed files, update media.json
  media.py pull   download everything listed in media.json (used by CI)

Asset names are the path under public/ with "/" replaced by "__". Needs the gh CLI.
"""
import hashlib, json, os, subprocess, sys
from pathlib import Path

ROOT = Path(os.environ.get("SITE_ROOT", ".")).resolve()
MANIFEST = ROOT / "media.json"
DATA = ROOT / "public" / "data"
TAG = "media"
SKIP_SUFFIX = {".rrd", ".db"}  # raw recordings and databases stay local (see catalog-publish.md)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def asset(rel):
    return rel.replace("/", "__")


def gh(*args, check=True):
    host = os.environ.get("GITHUB_SERVER_URL", "").removeprefix("https://")
    env = {**os.environ, **({"GH_HOST": host} if host else {})}
    return subprocess.run(["gh", *args], check=check, env=env, cwd=ROOT)


def load():
    return json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}


def push():
    if subprocess.run([sys.executable, str(ROOT / "tools" / "check_media.py")]).returncode:
        sys.exit("media push stopped: strip location metadata first (rule 11)")
    files = load()
    for path in sorted(DATA.rglob("*")):
        if not path.is_file() or path.suffix in SKIP_SUFFIX:
            continue
        rel = path.relative_to(ROOT / "public").as_posix()
        digest = sha256(path)
        if files.get(rel, {}).get("sha256") == digest:
            continue
        if gh("release", "view", TAG, check=False).returncode != 0:
            gh("release", "create", TAG, "--title", "Media", "--notes", "Large result files; see media.json.")
        tmp = path.parent / asset(rel)
        tmp.symlink_to(path.name)
        try:
            gh("release", "upload", TAG, "--clobber", str(tmp))
        finally:
            tmp.unlink()
        files[rel] = {"sha256": digest, "bytes": path.stat().st_size}
        print("uploaded", rel)
    MANIFEST.write_text(json.dumps(files, indent=2, sort_keys=True) + "\n")


def pull():
    for rel, meta in load().items():
        dest = ROOT / "public" / rel
        if dest.exists() and sha256(dest) == meta["sha256"]:
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        gh("release", "download", TAG, "--pattern", asset(rel), "--output", str(dest), "--clobber")
        if sha256(dest) != meta["sha256"]:
            sys.exit(f"checksum mismatch: {rel}")
        print("downloaded", rel)


if __name__ == "__main__":
    {"push": push, "pull": pull}.get(sys.argv[1] if len(sys.argv) > 1 else "", lambda: sys.exit(__doc__))()
