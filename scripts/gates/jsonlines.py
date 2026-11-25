"""Compact JSON for generated files: one list item per line, so a diff stays readable and the file small."""
import json


def dumps(data):
    return "{\n" + ",\n".join(
        f"{json.dumps(k)}:[\n" + ",\n".join(json.dumps(i) for i in v) + "\n]" for k, v in data.items()
    ) + "\n}\n"
