#!/usr/bin/env python3
"""Reject media that carries a location (rule 11: the customer stays anonymous).

Images: any EXIF GPS latitude or longitude. Videos: a container `location` tag.
Checks the given files, or else every tracked image and every file under public/data.
"""
import os
import json, shutil, subprocess, sys
from pathlib import Path

from PIL import Image

ROOT = Path(os.environ.get("SITE_ROOT", ".")).resolve()
IMAGES = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp", ".heic"}
VIDEOS = {".mp4", ".mov", ".m4v"}
GPS_IFD, LAT, LON = 34853, 2, 4


def image_location(path):
    gps = Image.open(path).getexif().get_ifd(GPS_IFD)
    return any(k in gps for k in (LAT, LON))


def video_location(path):
    if not shutil.which("ffprobe"):
        return False
    out = subprocess.run(["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(path)],
                         capture_output=True, text=True).stdout
    tags = json.loads(out or "{}").get("format", {}).get("tags", {})
    return any("location" in k.lower() for k in tags)


def default_files():
    tracked = subprocess.run(["git", "ls-files"], capture_output=True, text=True, cwd=ROOT).stdout.split()
    data = (ROOT / "public" / "data").rglob("*")
    return [ROOT / p for p in tracked] + [p for p in data if p.is_file()]


def main(args):
    files = [Path(a) for a in args] or default_files()
    bad = []
    for path in files:
        suffix = path.suffix.lower()
        if not path.is_file():
            continue
        if (suffix in IMAGES and image_location(path)) or (suffix in VIDEOS and video_location(path)):
            bad.append(path)
    for path in bad:
        print(f"check_media: {path} carries a location; strip its metadata (rule 11)", file=sys.stderr)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
