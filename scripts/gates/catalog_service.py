#!/usr/bin/env python3
"""Read-only HTTP service over the catalog node's run folders, for the site page.

Run on the machine that holds the runs (the machine that runs jobs); reach it from the laptop
with an ssh tunnel:  ssh -L 8766:127.0.0.1:8766 HOST

  python3 scripts/gates/catalog_service.py --root <runs>/catalog [--port 8766]

Layout served: <root>/<experiment>/<run>/manifest.json plus the files it lists.
  GET /runs                          every run's manifest, newest first
  GET /runs/<experiment>/<run>       one manifest
  GET /runs/<experiment>/<run>/<file>  a file of that run (e.g. run.rrd), with Range
Listens on 127.0.0.1 only; there is no write path.
"""
import argparse
import json
import mimetypes
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

NAME = re.compile(r"^[A-Za-z0-9._-]+$")


def run_dir(root, experiment, run):
    if not (NAME.match(experiment) and NAME.match(run)) or ".." in (experiment, run):
        return None
    d = root / experiment / run
    return d if (d / "manifest.json").is_file() else None


def manifest(root, experiment, run):
    d = run_dir(root, experiment, run)
    if d is None:
        return None
    m = json.loads((d / "manifest.json").read_text())
    base = f"/runs/{experiment}/{run}/"
    for item in m.get("items", []):
        item["url"] = base + item["file"]
    return m


def all_runs(root):
    runs = []
    for mf in sorted(root.glob("*/*/manifest.json")):
        m = manifest(root, mf.parent.parent.name, mf.parent.name)
        if m:
            runs.append(m)
    runs.sort(key=lambda m: (m.get("date", ""), m["run"]), reverse=True)
    return runs


def make_handler(root):
    class Handler(BaseHTTPRequestHandler):
        def send_json(self, code, body):
            data = json.dumps(body).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            parts = [unquote(p) for p in urlparse(self.path).path.strip("/").split("/")]
            if parts == ["runs"]:
                return self.send_json(200, all_runs(root))
            if parts[:1] == ["runs"] and len(parts) == 3:
                m = manifest(root, parts[1], parts[2])
                return self.send_json(200 if m else 404, m or {"error": "no such run"})
            if parts[:1] == ["runs"] and len(parts) == 4:
                return self.send_file(parts[1], parts[2], parts[3])
            self.send_json(404, {"error": "not found"})

        def send_file(self, experiment, run, name):
            m = manifest(root, experiment, run)
            if not m or name not in {i["file"] for i in m.get("items", [])}:
                return self.send_json(404, {"error": "not a file of this run"})
            path = run_dir(root, experiment, run) / name
            if not path.is_file():
                return self.send_json(404, {"error": "file missing"})
            size = path.stat().st_size
            start, end, code = 0, size - 1, 200
            rng = re.match(r"bytes=(\d*)-(\d*)$", self.headers.get("Range", ""))
            if rng and (rng[1] or rng[2]):
                if rng[1]:
                    start = int(rng[1])
                    end = min(int(rng[2]) if rng[2] else end, size - 1)
                else:
                    start = max(size - int(rng[2]), 0)
                if start > end:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.end_headers()
                    return
                code = 206
            self.send_response(code)
            self.send_header("Content-Type", mimetypes.guess_type(name)[0] or "application/octet-stream")
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(end - start + 1))
            if code == 206:
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            with path.open("rb") as f:
                f.seek(start)
                left = end - start + 1
                while left > 0:
                    chunk = f.read(min(1 << 20, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)

        def log_message(self, *args):
            pass

    return Handler


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", required=True, type=Path)
    ap.add_argument("--port", type=int, default=8766)
    args = ap.parse_args()
    ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(args.root.expanduser().resolve())).serve_forever()


if __name__ == "__main__":
    main()
