"""Embedding worker for ADR semantic search: one JSON request per line on stdin, one reply per line on stdout.

Request {"id": n, "texts": [...]} -> {"id": n, "vectors": [[...], ...]} (L2-normalised). Runs on CPU with fastembed (ONNX).
Started by src/semantic.mjs through `uv run --with fastembed`, so nothing is installed into a project or system Python.
"""
import json
import sys

from fastembed import TextEmbedding

model = TextEmbedding("BAAI/bge-small-en-v1.5")
print(json.dumps({"ready": True}), flush=True)
for line in sys.stdin:
    request = json.loads(line)
    vectors = [vector.tolist() for vector in model.embed(request["texts"])]
    print(json.dumps({"id": request["id"], "vectors": vectors}), flush=True)
