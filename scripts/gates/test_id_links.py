"""Warn where a page's prose names one of its own test ids or run names without backticks (the site links only backticked ones).
  python3 scripts/gates/test_id_links.py          list the pages and counts
  python3 scripts/gates/test_id_links.py --check  one warning per page"""
import os
import re
import sys
from pathlib import Path

root = Path(os.environ.get("SITE_ROOT", ".")).resolve()
TEST = re.compile(r"\{id: ([\w-]+),.*?check: \{run: ([\w-]+)")


def bare(text, names):
    body = text.split("---", 2)[-1]
    body = re.sub(r"```.*?```|`[^`\n]*`|\$[^$\n]*\$|\[[^\]\n]*\]\([^)\n]*\)", " ", body, flags=re.S)
    return sorted({n for n in names if re.search(rf"(?<![\w-]){re.escape(n)}(?![\w-])", body)})


def pages():
    for f in sorted((root / "experiments").glob("*.md")):
        text = f.read_text()
        names = {n for t in TEST.findall(text.split("---", 2)[1] if text.startswith("---") else "") for n in t}
        found = bare(text, names) if names else []
        if found:
            yield f.stem, found


if __name__ == "__main__":
    for page, found in pages():
        print(f"warning: experiments/{page}.md: test ids in prose without backticks ({', '.join(found[:6])}); the site links only backticked ids")
