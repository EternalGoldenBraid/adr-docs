#!/usr/bin/env python3
"""Reject staged files over 50 KB; large files go to a release (scripts/gates/media.py push).

Only files added or changed in this commit are checked, so older large files stay
warnings in check_plan.py until they are moved.
"""
import os
import subprocess, sys
from pathlib import Path

LIMIT = 50 * 1024
ROOT = Path(os.environ.get("SITE_ROOT", ".")).resolve()

staged = subprocess.run(["git", "diff", "--cached", "--name-only", "--diff-filter=AM", "-z"],
                        capture_output=True, text=True, cwd=ROOT).stdout.split("\0")
big = []
for f in filter(None, staged):
    size = int(subprocess.run(["git", "cat-file", "-s", f":{f}"], capture_output=True, text=True, cwd=ROOT).stdout or 0)
    if size > LIMIT:
        big.append(f"{f} ({size // 1024} KB)")
if big:
    print("error: staged files over 50 KB; put them in a release with scripts/gates/media.py push:\n  " + "\n  ".join(big))
    sys.exit(1)
