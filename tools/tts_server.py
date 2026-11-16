"""Small local text-to-speech server for ADR's "read aloud" (F5-TTS, voice cloned from a reference clip).

Runs where F5-TTS is installed (e.g. the gpu box) and listens on 127.0.0.1 only; ADR reaches it through an
ssh tunnel (tools/tts.mjs). POST /speak with {"text": "..."} returns audio/wav. The model loads once.

    CUDA_VISIBLE_DEVICES=1 ~/venvs/f5/bin/python tts_server.py --ref ref.wav [--port 8765]
"""
import argparse
import io
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock

import soundfile as sf
import torchaudio

# torchcodec cannot load here, so torchaudio.load is replaced by a soundfile reader before f5_tts imports it.
import torch


def _load(path, *args, **kwargs):
    data, rate = sf.read(path, dtype="float32", always_2d=True)
    return torch.from_numpy(data.T.copy()), rate


torchaudio.load = _load

from f5_tts.api import F5TTS  # noqa: E402

parser = argparse.ArgumentParser()
parser.add_argument("--ref", required=True, help="reference voice clip (mono, 5-15 s)")
parser.add_argument("--ref-text", default="", help="transcript of the clip; empty = transcribe automatically")
parser.add_argument("--port", type=int, default=8765)
parser.add_argument("--speed", type=float, default=0.95)
args = parser.parse_args()

model = F5TTS()
lock = Lock()


def speak(text):
    with lock:
        wave, rate, _ = model.infer(ref_file=args.ref, ref_text=args.ref_text, gen_text=text, speed=args.speed)
    buffer = io.BytesIO()
    sf.write(buffer, wave, rate, format="WAV")
    return buffer.getvalue()


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/speak":
            return self.send_error(404)
        text = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0)) or 0) or b"{}").get("text", "").strip()
        if not text:
            return self.send_error(400, "no text")
        audio = speak(text[:4000])
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(audio)))
        self.end_headers()
        self.wfile.write(audio)

    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *_):
        pass


print(f"ready on 127.0.0.1:{args.port}", flush=True)
ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
