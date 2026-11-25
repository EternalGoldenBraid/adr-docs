#!/usr/bin/env python3
"""Morning review bell: tell every local agent that the review session starts, with the agenda. No model."""
import os
import json
import pathlib
import subprocess

root = pathlib.Path(os.environ.get("SITE_ROOT", ".")).resolve()
BELL = pathlib.Path.home() / ".dotfiles/bin/mesh-bell"
agenda = subprocess.run(["python3", str(pathlib.Path(__file__).parent / "exp_index.py"), "--agenda"], capture_output=True, text=True).stdout.strip()
text = ("Morning review session. Site manager chairs in the room. For each of your done tests below, announce the "
        "observed effort or object to it. Undisputed tests are closed and counted in the effort per day.\n\n"
        + (agenda or "Nothing to review today."))
sessions = json.loads((root / ".dispatch-sessions.json").read_text())
done = set()
for agent, s in sorted(sessions.items()):
    if s["session"] in done:
        continue
    done.add(s["session"])
    r = subprocess.run([str(BELL), *(["--machine", s["machine"]] if s.get("machine") else []), "--to", s["session"], "--name", "review-bell", "--stdin"], input=text + "\n", text=True, capture_output=True)
    print(agent, "sent" if not r.returncode else r.stderr.strip())
