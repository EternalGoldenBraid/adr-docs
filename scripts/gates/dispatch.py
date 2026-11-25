#!/usr/bin/env python3
"""Send hand-over and failure messages for new lines of .queue-events.jsonl, with no model.

A page in review that loses its last blocker tells its owner to set it done. A test that turns done tells the doers of the tests that waited on it. A test that turns failed or lost
tells its owner and those doers. Messages go out with mesh-bell, including agents on a peer machine (`machine`); an agent without a session in .dispatch-sessions.json, or a failed send, is listed as undelivered.

.dispatch-sessions.json (gitignored): {"agent-slug": {"session": "<id>", "machine": "host-a"}}. `machine` is optional.
.dispatch-state.json (gitignored) remembers how many event lines were handled.
"""
import json
import os
import pathlib
import subprocess
import sys

root = pathlib.Path(os.environ.get("SITE_ROOT", ".")).resolve()
events_file = root / ".queue-events.jsonl"
sessions_file = root / ".dispatch-sessions.json"
state_file = root / ".dispatch-state.json"
BELL = pathlib.Path.home() / ".dotfiles/bin/mesh-bell"


def messages(ev):
    """(agent, text) pairs for one event."""
    test = f"{ev['test']} ({ev['page']})"
    if ev["state"] == "unblocked":
        return [(ev["owner"], f"no blockers left on {ev['page']}; check it and set status done.")]
    if ev["state"] == "rejected":
        return [(ev["owner"], f"{ev['page']} was sent back: it cannot be planned or started without {', '.join(ev['missing'])}. Add them, then set the status again.")] if ev.get("owner") else []
    if ev["state"] == "done":
        return [(u["doer"], f"{test} finished, your item {u['id']} ({u['page']}) is ready; start it or name the blocker.")
                for u in ev.get("unblocks", []) if u.get("doer")]
    people = {ev.get("owner"), ev.get("by"), *(u.get("doer") for u in ev.get("unblocks", []))} - {None}
    return [(a, f"{test} {ev['state']}; the owner restarts it or reports why. Waiting on it: "
                f"{', '.join(u['id'] for u in ev.get('unblocks', [])) or 'nothing'}.") for a in sorted(people)]


def main():
    lines = events_file.read_text().splitlines() if events_file.exists() else []
    seen = json.loads(state_file.read_text()).get("seen", 0) if state_file.exists() else 0
    sessions = json.loads(sessions_file.read_text()) if sessions_file.exists() else {}
    seen = min(seen, len(lines))
    undelivered = []
    for line in lines[seen:]:
        ev = json.loads(line)
        if ev["state"] not in ("done", "failed", "lost", "unblocked", "rejected"):
            continue
        for agent, text in messages(ev):
            target = sessions.get(agent)
            if not target:
                undelivered.append(f"{agent}: {text}")
                continue
            r = subprocess.run([str(BELL), *(["--machine", target["machine"]] if target.get("machine") else []),
                                "--to", target["session"], "--name", os.environ.get("EXP_SENDER", "coordinator"), "--stdin"],
                               input=f"Site manager: {text}\n", text=True, capture_output=True)
            if r.returncode:
                undelivered.append(f"{agent}: {text} ({r.stderr.strip()})")
    state_file.write_text(json.dumps({"seen": len(lines)}))
    for u in undelivered:
        print("undelivered", u, file=sys.stderr)


main()
