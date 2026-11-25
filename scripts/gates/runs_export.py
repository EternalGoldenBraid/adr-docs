#!/usr/bin/env python3
"""Copy the finished catalog runs that pages use into public/data/runs, so the published site has no catalog.

  runs_export.py [--catalog http://127.0.0.1:8766]

A page uses a run when the run name appears in the page, or in its front matter as `video: {run: ...}`.
Scalars are copied for every such run; the video only for runs named in a `video:` test, sped up 4x
(every 4th frame, same frame rate) and re-encoded; one video over MAX_VIDEO bytes stops the export.
Then `python3 scripts/gates/media.py push` uploads the files. Plot.vue and Video.vue read /data/runs when the
catalog does not answer.
"""
import os
import argparse, json, re, subprocess, sys, tempfile, urllib.request
from pathlib import Path

ROOT = Path(os.environ.get("SITE_ROOT", ".")).resolve()
OUT = ROOT / "public" / "data" / "runs"
SPEEDUP = 4
MAX_VIDEO = 20_000_000


def shrink(raw, dest):
    with tempfile.NamedTemporaryFile(suffix=".mp4") as src:
        src.write(raw)
        src.flush()
        vf = f"select='not(mod(n,{SPEEDUP}))',setpts=N/(FRAME_RATE*TB)"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src.name, "-an", "-vf", vf, "-c:v", "libx264", "-crf", "30",
                        "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(dest)], check=True)
    if dest.stat().st_size > MAX_VIDEO:
        sys.exit(f"{dest} is {dest.stat().st_size} bytes, over the {MAX_VIDEO} limit: shorten or crop the run's video")


def get(url):
    with urllib.request.urlopen(url, timeout=120) as r:
        return r.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", default="http://127.0.0.1:8766")
    base = ap.parse_args().catalog
    runs = json.loads(get(base + "/runs"))
    index = []
    for page in sorted((ROOT / "experiments").glob("*.md")):
        text = page.read_text()
        front = (re.match(r"---\n(.*?)\n---", text, re.S) or [None, ""])[1]
        videos = set(re.findall(r"video: \{run: ([^,}\s]+)", front))
        for m in runs:
            if m["experiment"] != page.stem or m.get("progress", {}).get("phase") != "done" or m["run"] not in text:
                continue
            dest = OUT / m["experiment"] / m["run"]
            dest.mkdir(parents=True, exist_ok=True)
            items = []
            for i in m["items"]:
                if i["kind"] != "scalars" and not (i["kind"] == "video" and m["run"] in videos):
                    continue
                f = dest / i["file"]
                if not f.exists():
                    raw = get(base + i["url"])
                    shrink(raw, f) if i["kind"] == "video" else f.write_bytes(raw)
                items.append({**i, "url": f"/data/runs/{m['experiment']}/{m['run']}/{i['file']}"})
            index.append({**m, "items": items})
    (OUT / "index.json").write_text(json.dumps(index))
    print(f"{len(index)} runs exported")


if __name__ == "__main__":
    sys.exit(main())
