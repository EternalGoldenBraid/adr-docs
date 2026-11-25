#!/usr/bin/env python3
"""Experiment index: check each entry's front matter and fill the tables generated from it.

Every experiments/*.md needs `date` (YYYY-MM-DD), `status` (todo | planned | running | review | done | abandoned)
and `question`, `owner` (one agent name) and optionally `participants: [name, ...]` and `reviewer: <name>` (in its queue while in review); `verdict` (a block: result supported | not-supported | inconclusive, claim, confidence hypothesis | confirmed) and a `## What we learned` section too once done or abandoned.
On done or abandoned pages a body line "Status: **x**" must match the front matter status.
The card's `tests:` list (name, state, date) adds checks on state, derived status and a 2-day stale limit.
These checks only warn until EXP_STRICT=1 is set (after the backfill),
except that a missing owner, card or test id (not for a todo, an idea) fails for any experiment page in the commit being made.
A page lists entries between markers:

    <!-- experiments {} -->                          every entry, with its section
    <!-- experiments {"topic": "my-topic"} -->  entries of that topic
    <!-- /experiments -->

python3 tools/exp_index.py           rewrite the tables
python3 tools/exp_index.py --agenda    done tests with an estimate that the morning review has not closed
python3 tools/exp_index.py --close page/id ...   close reviewed tests (they move to the past list)
python3 tools/exp_index.py --split page id,id new-slug   move planned tests that do not fit the day to a new todo page
python3 tools/exp_index.py --mode [free|gated]      write work-mode.json; in free mode the gates warn and block nothing; no argument shows it
python3 tools/exp_index.py --freeze [on reason|off]   write freeze.json (agents finish, commit, take no new item); no argument shows it
python3 tools/exp_index.py --collect   derive experiments/<stem>/tests.json from runs.jsonl; list failed or lost tests
python3 tools/exp_index.py --check   fail on a bad entry or a stale table (commit hook)
"""
import datetime, json, os, re, subprocess, sys
from pathlib import Path
import jsonlines

root = Path(__file__).resolve().parent.parent
STATUSES = ("todo", "planned", "running", "review", "done", "abandoned")
TMARK = re.compile(r"<!-- test: ([\w-]+)#([\w-]+) -->.*?<!-- /test -->")
MARK = re.compile(r"<!-- experiments (\{.*?\}) -->\n.*?<!-- /experiments -->", re.S)


def front(path):
    m = re.match(r"---\n(.*?)\n---", path.read_text(), re.S)
    out = {}
    for line in m.group(1).splitlines() if m else []:
        if ":" in line and not line.startswith(" "):
            k, v = line.split(":", 1)
            v = v.strip()
            if len(v) > 1 and v[0] == v[-1] == '"':
                v = json.loads(v)
            elif v.startswith("[") and v.endswith("]"):
                v = [x.strip().strip("\"'") for x in v[1:-1].split(",") if x.strip()]
            out[k.strip()] = v
    return out


STALE_DAYS = 2
TEST_STATES = ("done", "running", "planned", "obsolete")
CHECK_STATS = ("min", "max", "last", "median", "mean")
CHECK_OPS = ("<", "<=", ">", ">=")


RESULTS = ("supported", "not-supported", "inconclusive")
CONFIDENCES = ("hypothesis", "confirmed")


def verdict_of(path):
    """The page's verdict: a block {result, claim, confidence}, or a free-text string (old form), or None."""
    try:
        import yaml
        m = re.match(r"---\n(.*?)\n---", path.read_text(), re.S)
        return (yaml.safe_load(m.group(1)) or {}).get("verdict") if m else None
    except Exception:
        return front(path).get("verdict") or None


def verdict_problem(v):
    if not isinstance(v, dict):
        return "verdict must be a block: result, claim, confidence"
    if v.get("result") not in RESULTS:
        return f"verdict.result must be one of {'|'.join(RESULTS)}"
    if not str(v.get("claim") or "").strip():
        return "verdict.claim is empty (one line)"
    if v.get("confidence") not in CONFIDENCES:
        return f"verdict.confidence must be one of {'|'.join(CONFIDENCES)}"
    return None


def card_tests(path):
    """Tests listed in the card, or None when the page has none (or PyYAML is missing)."""
    try:
        import yaml
    except ImportError:
        return None
    m = re.match(r"---\n(.*?)\n---", path.read_text(), re.S)
    card = (yaml.safe_load(m.group(1)) or {}).get("card") if m else None
    return card.get("tests") if isinstance(card, dict) else None


BAD_MARKS = []


def tests_state(m):
    """Fill a `<!-- test: stem#id -->` cell with one mark for that single test."""
    page = root / "experiments" / f"{m.group(1)}.md"
    t = next((t for t in (card_tests(page) if page.exists() else None) or [] if t.get("id") == m.group(2)), None)
    if t is None:
        BAD_MARKS.append(f"<!-- test: {m.group(1)}#{m.group(2)} --> names no test")
        txt = "❓"
    elif t.get("result") == "fail":
        txt = "❌"
    else:
        txt = {"done": "✅", "running": "🟡", "obsolete": "➖"}.get(t.get("state"), "⬜")
    return f"<!-- test: {m.group(1)}#{m.group(2)} -->{txt}<!-- /test -->"


def check_tests(p, f, today):
    """Warnings for the card's tests: bad state, status not derived from them, stale page."""
    tests = card_tests(p)
    if not tests:
        return []
    rel, out = p.relative_to(root), []
    for t in tests:
        if t.get("state") in ("planned", "running") and not (t.get("doer") and t.get("rank")):
            out.append(f"{rel}: test '{t.get('name')}' has no doer or rank (its place in an agent's queue)")
        if not t.get("id"):
            out.append(f"{rel}: test '{t.get('name')}' has no id (the run's --test value)")
        c = t.get("check")
        if t.get("kind") == "video" and not (isinstance(t.get("video"), dict) and t["video"].get("run")):
            out.append(f"{rel}: test '{t.get('id')}' is a video but has no video: {{run: <catalog run>}}")
        if t.get("kind") in ("experiment", "run") and not c and t.get("state") in ("planned", "running"):
            out.append(f"{rel}: test '{t.get('id')}' runs an experiment (kind: experiment or run) but has no check, the data condition that ticks it")
        if c and not (isinstance(c, dict) and c.get("field") and c.get("stat") in CHECK_STATS and c.get("op") in CHECK_OPS and isinstance(c.get("value"), (int, float))):
            out.append(f"{rel}: test '{t.get('id')}' has a bad check; it needs field, stat ({'|'.join(CHECK_STATS)}), op ({'|'.join(CHECK_OPS)}) and a number value")
        if t.get("state") not in TEST_STATES:
            out.append(f"{rel}: test '{t.get('name')}' has state '{t.get('state')}', not {'|'.join(TEST_STATES)}")
    for sid in sorted(set(re.findall(r'<Video\s+test="([^"]+)"', p.read_text()))):
        if (next((x for x in tests if x.get("id") == sid), {})).get("kind") != "video":
            out.append(f"{rel}: <Video test=\"{sid}\" /> names no test of kind video")
    d = f.get("data")
    if d and not re.fullmatch(r"[\w.-]+/[\w.-]+", str(d)):
        out.append(f"{rel}: data '{d}' is not a catalog run (data: <experiment>/<run>)")
    if (d or f.get("nodata")) and "<Data />" not in p.read_text():
        out.append(f"{rel}: put <Data /> under the title, so the page links its dataset")
    slots = set(re.findall(r'<Check\s+test="([^"]+)"', p.read_text()))
    by_id = {t.get("id"): t for t in tests}
    for sid in sorted(slots):
        if not (by_id.get(sid) or {}).get("check"):
            out.append(f"{rel}: <Check test=\"{sid}\" /> names no test with a check")
    for t in tests:
        if t.get("check") and t.get("state") in ("planned", "running") and t.get("id") not in slots:
            out.append(f"{rel}: test '{t.get('id')}' has a check but the page has no <Check test=\"{t.get('id')}\" /> slot to show it")
    open_ = [t for t in tests if t.get("state") in ("running", "planned")]
    derived = "running" if any(t.get("state") == "running" for t in tests) else "planned" if open_ else None
    if f.get("status") == "done" and open_:
        out.append(f"{rel}: status done, but {len(open_)} test(s) are still running or planned")
    elif f.get("status") == "running" and derived is None:
        out.append(f"{rel}: every test is done or obsolete; close the page")
    dates = [str(d) for t in tests for d in (t.get("date"), t.get("reviewed")) if d]
    if f.get("status") == "running" and dates:
        age = (today - datetime.date.fromisoformat(max(dates))).days
        if age > STALE_DAYS:
            out.append(f"{rel}: stale, last test date {age} days ago (limit {STALE_DAYS}); split or close it")
    return out


LOST_MIN = 5


def ledger_states(stem, now):
    """Per test: state, run, by, at, code from the newest ledger event (experiments/<stem>/runs.jsonl)."""
    path = root / "experiments" / stem / "runs.jsonl"
    latest = {}
    if path.exists():
        for line in path.read_text().splitlines():
            try:
                ev = json.loads(line)
            except ValueError:
                continue
            key = ev.get("test") or ev.get("run")
            if key and (key not in latest or ev["at"] >= latest[key]["at"]):
                latest[key] = ev
    out = {}
    for key, ev in latest.items():
        if ev["event"] == "end":
            state = "done" if ev.get("result") == "pass" else "failed"
        else:
            age = (now - datetime.datetime.fromisoformat(ev["at"].replace("Z", "+00:00"))).total_seconds() / 60
            state = "lost" if age > LOST_MIN else "running"
        out[key] = {"state": state, "run": ev.get("run"), "by": ev.get("by"), "at": ev["at"], "code": ev.get("code"),
                    **{k: ev[k] for k in ("host", "log", "pid") if ev.get(k)}}
    return out


def card_pages():
    """Every page in this repo with a `card:` block, wherever it lives, so a card always reaches the queue."""
    skip = {".adr", ".git", "node_modules", "public", ".vitepress", ".adr-data"}
    return [p for p in sorted(root.rglob("*.md"))
            if not skip & set(p.relative_to(root).parts) and re.match(r"---\n(?:(?!\n---).)*?\ncard:", p.read_text(), re.S)]


def dependents(stem, key):
    """(page, id, doer) of card tests whose `after` names this test."""
    out = []
    for p in card_pages():
        for t in card_tests(p) or []:
            if {key, f"{stem}/{key}"} & set(t.get("after") or []):
                out.append({"page": p.stem, "id": t.get("id"), "doer": t.get("doer")})
    return out


def start_problems(p, f):
    """What a page must have to be planned, and so before it can run."""
    out = []
    if not f.get("owner"):
        out.append("owner")
    if not re.search(r"^  gist:\s*\S", p.read_text(), re.M):
        out.append("gist")
    if not any(t.get("id") for t in card_tests(p) or []):
        out.append("tests with ids")
    tests = card_tests(p) or []
    if any(t.get("check") for t in tests) and not any(t.get("kind") == "video" for t in tests) and not f.get("novideo"):
        out.append("a video test (kind: video with video: {run}) or `novideo: <reason>`")
    if any(t.get("check") for t in tests) and not (f.get("data") or f.get("nodata")):
        out.append("the dataset the runs use (`data: <catalog run or path>`) or `nodata: <reason>`")
    return out


def page_voted(p):
    """True when the agents have agreed (`voted: true` in the front matter), the ceremony before a page leaves planned."""
    return str(front(p).get("voted")).lower() == "true"


def set_status(p, status):
    text = p.read_text()
    p.write_text(re.sub(r"^status:.*$", f"status: {status}", text, count=1, flags=re.M))


TENSE = {"todo": "future", "planned": "future", "running": "present", "review": "present", "done": "past", "abandoned": "past"}
HUBS = {"future": "experiments-future", "present": "experiments-present", "past": "experiments-past"}


def set_front(p, key, value):
    """Set one top-level front matter key, replacing its line or adding it after the first line."""
    text = p.read_text()
    line = f"{key}: {value}"
    if re.search(rf"^{key}:.*$", text.split("\n---", 1)[0], re.M):
        new = re.sub(rf"^{key}:.*$", line, text, count=1, flags=re.M)
    else:
        new = text.replace("---\n", f"---\n{line}\n", 1)
    if new != text:
        p.write_text(new)
        return True
    return False


def started_tests(p):
    """Ids of tests that are running or done, in the card or in the run ledger."""
    ids = [t.get("id") for t in card_tests(p) or [] if t.get("state") in ("running", "done")]
    tj = root / "experiments" / p.stem / "tests.json"
    if tj.exists():
        ids += [k for k, v in json.loads(tj.read_text()).get("tests", {}).items() if v.get("state") in ("running", "done")]
    return ids


def sync_tree(p, f):
    """One label: the status. Tense and the tree branch (Future, Present, Past) follow from it."""
    tense = TENSE.get(f.get("status"))
    if not tense:
        return
    if f.get("tense") != tense and set_front(p, "tense", tense):
        print(f"tense: {p.stem} is {f['status']}, so {tense}")
    par = f.get("parent", "")
    if not par.startswith("experiments/") and par != HUBS[tense]:
        if par and par not in HUBS.values() and "topic" not in f:
            set_front(p, "topic", par)
        if set_front(p, "parent", HUBS[tense]):
            print(f"branch: {p.stem} moved under {HUBS[tense]}")


def free_mode():
    """Free work mode: gates warn and block nothing; the records stay."""
    f = root / "work-mode.json"
    return f.exists() and json.loads(f.read_text()).get("mode") == "free"


def guard_status():
    """Todo may be bare (an idea). Planned, running and review need owner, gist and tests with ids: a page that claims them
    without goes back to where it was (todo or planned) and its owner is told. Tense and branch follow the status.
    A planned page whose test runs or is done becomes running; a running page whose tests are all done or obsolete becomes review."""
    state_file = root / ".status-state.json"
    first = not state_file.exists()
    seen = {} if first else json.loads(state_file.read_text())
    now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    for p in sorted((root / "experiments").glob("*.md")):
        f = front(p)
        cur, prev = f.get("status"), seen.get(p.stem, "todo")
        if cur in ("planned", "running", "review") and prev in ("todo", "planned") and not first:
            bad = start_problems(p, f)
            if cur in ("running", "review") and prev == "planned" and not page_voted(p):
                bad.append("the vote (voted: true in the front matter)")
            if bad and free_mode():
                print(f"warning: {p.stem} left {prev} missing {', '.join(bad)} (free work mode)")
            elif bad:
                set_status(p, prev)
                cur = prev
                print(f"rejected: {p.stem} cannot leave {prev}, missing {', '.join(bad)}")
                with open(root / ".queue-events.jsonl", "a") as log:
                    log.write(json.dumps({"at": now, "page": p.stem, "test": "status", "state": "rejected", "by": None,
                                          "owner": f.get("owner"), "missing": bad, "unblocks": []}) + "\n")
        elif cur == "planned" and prev in ("running", "review", "done", "abandoned") and not first:
            set_front(p, "voted", "false")
            print(f"back to planned: {p.stem} needs its vote again")
        elif cur in ("todo", "planned") and not start_problems(p, f) and (cur == "todo" or page_voted(p)) and started_tests(p):
            set_status(p, "running")
            cur = "running"
            print(f"running: {p.stem} has a test under way")
        if cur == "running":
            tests = card_tests(p) or []
            if tests and all(t.get("state") in ("done", "obsolete") for t in tests):
                set_status(p, "review")
                cur = "review"
                print(f"review: {p.stem} has every test done")
        done_at = seen.setdefault("_done_at", {})
        if cur in ("done", "abandoned"):
            if prev not in ("done", "abandoned") and not first and open_threads(p.stem):
                set_status(p, "review")
                cur = "review"
                print(f"REVERTED to review: {p.stem} cannot be {f.get('status')} with open threads")
                with open(root / ".queue-events.jsonl", "a") as log:
                    log.write(json.dumps({"at": now, "page": p.stem, "test": "status", "state": "rejected", "by": None,
                                          "owner": None, "missing": ["open threads"], "unblocks": []}) + "\n")
            else:
                done_at.setdefault(p.stem, now)
        else:
            done_at.pop(p.stem, None)
        sync_tree(p, front(p))
        if cur:
            seen[p.stem] = cur
    state_file.write_text(json.dumps(seen, indent=1))


def purge_trash(dry=False):
    """Delete pages under trash/ whose front matter `delete_after` date has passed, and log each one."""
    today = datetime.date.today().isoformat()
    gone = []
    for p in sorted((root / "trash").rglob("*.md")):
        due = front(p).get("delete_after", "")
        if due and due <= today:
            gone.append(p)
            if not dry:
                p.unlink()
                with open(root / ".trash-log.jsonl", "a") as log:
                    log.write(json.dumps({"at": today, "deleted": str(p.relative_to(root))}) + "\n")
    if not dry:
        for d in sorted((root / "trash").rglob("*"), reverse=True):
            if d.is_dir() and not any(d.iterdir()):
                d.rmdir()
    return gone


def collect():
    """Write experiments/<stem>/tests.json from the ledgers, and list failed or lost tests."""
    now = datetime.datetime.now(datetime.timezone.utc)
    for ledger in sorted((root / "experiments").glob("*/runs.jsonl")):
        stem = ledger.parent.name
        states = ledger_states(stem, now)
        f = front(root / "experiments" / f"{stem}.md")
        people = sorted({f.get("owner", "")} | {v["by"] for v in states.values() if v.get("by")} - {""})
        out = {"tests": states, "participants": people}
        target = ledger.parent / "tests.json"
        text = json.dumps(out, indent=2, sort_keys=True) + "\n"
        before = json.loads(target.read_text()).get("tests", {}) if target.exists() else {}
        with open(root / ".queue-events.jsonl", "a") as log:
            for key, v in states.items():
                if v["state"] in ("done", "failed", "lost") and before.get(key, {}).get("state") != v["state"]:
                    log.write(json.dumps({"at": now.isoformat(timespec="seconds"), "page": stem, "test": key, "state": v["state"],
                                          "by": v.get("by"), "owner": f.get("owner"), "unblocks": dependents(stem, key)}) + "\n")
        if not target.exists() or target.read_text() != text:
            target.write_text(text)
            print(f"updated {target.relative_to(root)}")
        for key, v in states.items():
            if v["state"] in ("failed", "lost"):
                print(f"{v['state']}: {stem}/{key} (run {v['run']}, by {v['by']}, owner {f.get('owner')})")
    guard_status()
    for p in purge_trash():
        print(f"purged {p.relative_to(root)}")
    unblocked_events()


def unresolved_threads(stem):
    """Ids of addressed threads on a page that nobody has resolved, answered or not (from ADR's comment store)."""
    store = root / ".adr-data" / "comments.jsonl"
    if not store.exists():
        return []
    roots, resolved = {}, {}
    for line in store.read_text().splitlines():
        c = json.loads(line)
        if c.get("event") == "comment" and c.get("to") and str(c.get("source", "")).endswith(f"/{stem}.md"):
            roots[c["id"]] = c
        if "resolved" in c and c.get("commentId"):
            resolved[c["commentId"]] = c["resolved"]
    return [i[:8] for i in roots if not resolved.get(i)]


def voted(test_id, typed_weight, typed_votes):
    """The weight decided in votes.json (ADR's vote store, item = test id) wins over a guess typed on the card."""
    vf = root / "votes.json"
    for v in json.loads(vf.read_text()) if vf.exists() else []:
        if v.get("item") == test_id and v.get("weight") is not None:
            last = (v.get("rounds") or [{}])[-1].get("votes", {})
            return v["weight"], list(last.values())
    return typed_weight, typed_votes


def unbuilt_nodes(path):
    """Graph nodes on the page marked ☐ or ◐ that sit on no dashed (planned) edge."""
    out = []
    for src in re.findall(r'<DocGraph[^>]*\bsrc="([^"]+)"', path.read_text()):
        g = root / "public" / src.lstrip("/")
        if not g.exists():
            continue
        data = json.loads(g.read_text())
        planned = {e[k] for e in data.get("edges", []) if e.get("dashed") for k in ("source", "target")}
        out += [n["title"] for n in data.get("nodes", []) if n.get("status") in ("☐", "◐") and n["id"] not in planned]
    return out


def blockers(path):
    """What keeps a page from done: open threads, no gist, no valid verdict, unfinished tests."""
    out = []
    if open_threads(path.stem) or unresolved_threads(path.stem):
        out.append("open threads")
    if not re.search(r"^  gist:\s*\S", path.read_text(), re.M):
        out.append("gist")
    if verdict_problem(verdict_of(path)):
        out.append("verdict")
    if any(t.get("state") not in ("done", "obsolete") for t in card_tests(path) or []):
        out.append("tests")
    if unbuilt_nodes(path):
        out.append("unbuilt graph nodes")
    if any(t.get("state") == "done" and estimate_of(t) and t.get("observed") not in FIB for t in card_tests(path) or []):
        out.append("observed effort")
    return out


def unblocked_events():
    """Log once when a page in review has lost its last blocker, so the owner is told to set it done."""
    state_file = root / ".blocked-state.json"
    seen = json.loads(state_file.read_text()) if state_file.exists() else {}
    now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    for p in sorted((root / "experiments").glob("*.md")):
        f = front(p)
        if f.get("status") != "review" or not f.get("owner"):
            seen.pop(p.stem, None)
            continue
        blocked = bool(blockers(p))
        if seen.get(p.stem, True) and not blocked:
            with open(root / ".queue-events.jsonl", "a") as log:
                log.write(json.dumps({"at": now, "page": p.stem, "test": "review", "state": "unblocked", "by": None,
                                      "owner": f["owner"], "unblocks": []}) + "\n")
        seen[p.stem] = blocked
    state_file.write_text(json.dumps(seen))


def roster_names():
    """Names in the Who column: the first table of team.md only."""
    names, seen = [], False
    for l in (root / "team.md").read_text().splitlines():
        if l.startswith("|"):
            seen = True
            if not l.startswith("|---") and not l.startswith("| Who"):
                names.append(l.split("|")[1].strip())
        elif seen:
            break
    return names


def slug(name, fold=True):
    name = name.lower().translate(str.maketrans("öäå", "oaa")) if fold else name.lower()
    return re.sub(r"[^a-z0-9]+", "-", name).strip("-")


def roster():
    """Agent slugs from team.md. ADR's slugger used to drop ö/ä/å; accept that spelling too."""
    names = roster_names()
    return {slug(n) for n in names} | {slug(n, False) for n in names}


DERIVED = ("parent", "tense", "topic")


def derived_only(name):
    """True when the staged front matter differs from HEAD only in keys the index derives from the status."""
    def keys(text):
        m = re.match(r"---\n(.*?)\n---", text, re.S)
        return {ln for ln in (m.group(1).splitlines() if m else []) if ln.split(":", 1)[0] not in DERIVED}
    old = subprocess.run(["git", "show", f"HEAD:{name}"], cwd=root, capture_output=True, text=True).stdout
    new = subprocess.run(["git", "show", f":{name}"], cwd=root, capture_output=True, text=True).stdout
    return keys(old) == keys(new)


def staged_pages():
    """Experiment pages whose front matter is in the commit being made (or that are new); their card fields must be complete.
    A change to the body alone, such as fixing a link, does not make an old page fill its card."""
    names = subprocess.run(["git", "diff", "--cached", "--name-only", "--", "experiments/*.md"],
                           cwd=root, capture_output=True, text=True).stdout.split()
    out = set()
    for n in names:
        staged = subprocess.run(["git", "show", f":{n}"], cwd=root, capture_output=True, text=True).stdout.splitlines()
        end = next((k for k, line in enumerate(staged[1:], 2) if line == "---"), 0)
        diff = subprocess.run(["git", "diff", "--cached", "-U0", "--", n], cwd=root, capture_output=True, text=True).stdout
        new = "new file mode" in diff
        if not new and derived_only(n):
            continue
        starts = [int(m.group(1)) for m in re.finditer(r"^@@ -\S+ \+(\d+)", diff, re.M)]
        if new or any(st <= end for st in starts):
            out.add(Path(n).name)
    return out


EXTERNAL_DOCS = Path(os.environ["EXP_EXTERNAL_DOCS"]) if os.environ.get("EXP_EXTERNAL_DOCS") else None  # optional separate site; its card tests join the queue, unlinked
HUMAN = os.environ.get("EXP_HUMAN", "maintainer")  # the person on team.md who is not an agent and has no queue
VMARK = re.compile(r"<!-- verdict -->\n.*?<!-- /verdict -->\n*", re.S)
QMARK = re.compile(r"<!-- queues -->\n.*?<!-- /queues -->", re.S)


def where(d):
    """Host, process id and log of the run, as far as the ledger start event gave them."""
    return " ".join(x for x in (d.get("host"), f"pid {d['pid']}" if d.get("pid") else "", Path(d["log"]).name if d.get("log") else "") if x)


def queues(today):
    """Per doer, the card tests still to do, by rank: a generated table for team.md, and the same as data.
    A test with `after: [ids]` waits until each listed test (bare id, or page/id) is done.
    `held` names why a test may not start (its ticket is todo or unvoted); idle nudges skip held items."""
    state_of, rows_in = {}, []
    for p in card_pages() + (sorted(EXTERNAL_DOCS.glob("*.md")) if EXTERNAL_DOCS else []):
        derived = {}
        tj = root / "experiments" / p.stem / "tests.json"
        if p.parent == root / "experiments" and tj.exists():
            derived = json.loads(tj.read_text()).get("tests", {})
        for t in card_tests(p) or []:
            d = derived.get(t.get("id"), {})
            state = d.get("state") or t.get("state")
            state_of[t.get("id")] = state_of[f"{p.stem}/{t.get('id')}"] = state
            if t.get("doer") and state not in ("done", "obsolete"):
                rows_in.append((p.stem, t, d, state))
    items = {}
    for stem, t, d, state in rows_in:
        waits = [a for a in t.get("after") or [] if state_of.get(a) not in ("done", "obsolete")]
        seen = [str(d) for d in (t.get("date"), t.get("reviewed")) if d]
        age = (today - datetime.date.fromisoformat(max(seen))).days if seen else 0
        weight, votes = voted(t.get("id"), t.get("weight", ""), t.get("votes", []))
        pg = root / "experiments" / f"{stem}.md"
        status = front(pg).get("status") if pg.exists() else ""
        held = "ticket is todo" if status == "todo" else "ticket is unvoted" if status == "planned" and not page_voted(pg) else ""
        items.setdefault(t["doer"], []).append({
            "rank": t.get("rank", 99), "test": t.get("name", ""), "id": t.get("id"), "page": stem,
            "state": state, "run": d.get("run") or "", "where": where(d), "weight": weight, "votes": votes,
            "after": t.get("after") or [], "waits": waits, "held": held, "age": age})
    tj = root / "threads.json"
    for t in json.loads(tj.read_text()) if tj.exists() else []:
        age = (today - datetime.datetime.fromisoformat(t["at"].replace("Z", "+00:00")).date()).days
        for who in t.get("unresolved_by", [w for w in t["addressees"] if w not in t["answered_by"]]):
            if who not in t["answered_by"]:  # resolving is no agent duty; only an unanswered thread is an item
                items.setdefault(who, []).append({
                    "rank": 0, "test": f"Answer thread {t['id'][:8]}", "id": f"thread-{t['id'][:8]}", "page": t["page"],
                    "kind": "thread", "state": "open", "run": "", "weight": "", "votes": [], "after": [], "waits": [], "age": age})
    for p in sorted((root / "experiments").glob("*.md")):
        f = front(p)
        n = len(blocking_threads(p.stem))
        if f.get("status") in ("done", "abandoned") and n and f.get("owner"):
            items.setdefault(f["owner"], []).append({
                "rank": 0, "test": f"Back in review: {n} open thread(s) on a {f['status']} page", "id": f"review-{p.stem}", "page": p.stem,
                "kind": "review", "state": "open", "run": "", "weight": "", "votes": [], "after": [], "waits": [], "age": 0})
    for p in sorted((root / "experiments").glob("*.md")):
        f = front(p)
        tests = card_tests(p) or []
        if f.get("status") == "review" and f.get("owner") and tests and all(t.get("state") in ("done", "obsolete") for t in tests):
            items.setdefault(f["owner"], []).append({
                "rank": 0, "test": "Close the ticket: every test is done or obsolete; set status done",
                "id": f"close-{p.stem}", "page": p.stem, "kind": "close", "state": "open", "run": "", "weight": "", "votes": [],
                "after": [], "waits": [], "age": 0})
        if f.get("status") == "review" and f.get("reviewer"):
            items.setdefault(f["reviewer"], []).append({
                "rank": 0, "test": "Review with the owner; actions send it back to running",
                "id": f"reviewer-{p.stem}", "page": p.stem, "kind": "review", "state": "open", "run": "", "weight": "", "votes": [],
                "after": [], "waits": [], "age": 0})
    key = lambda i: (i["rank"], i["test"])
    for name in roster_names():
        if slug(name) != HUMAN:
            items.setdefault(slug(name), [])
    data = {d: [{k: v for k, v in i.items() if k != "age"} for i in sorted(v, key=key)] for d, v in sorted(items.items())}
    rows = ["| Agent | # | Next item | Page | State | Run | Age | Weight | Waits on |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"]
    for doer in sorted(items):
        if not items[doer]:
            rows.append(f"| {doer} | | **empty queue** | | | | | | |")
        for i in sorted(items[doer], key=key):
            flag = " (review due)" if i["state"] == "planned" and i["age"] > STALE_DAYS and not i["waits"] else ""
            run = f"run {i['run']}" + (f" ({i['where']})" if i.get("where") else "") if i["run"] else ""
            rows.append(f"| {doer} | {i['rank']} | {cell(i['test'])} | {page_link(i['page'])} | "
                        f"{i['state']}{flag} | {run} | {i['age']} d | {i['weight']} | {', '.join(i['waits'])} |")
    return "\n".join(rows), data


FIB = (1, 2, 3, 5, 8, 13, 21)


def estimate_of(t):
    """The agreed point estimate of a card test: from votes.json when decided, else the weight typed on the card."""
    w = voted(t.get("id"), t.get("weight", ""), [])[0]
    return w if isinstance(w, int) else None


def effort_pairs():
    """(page, id, estimated, observed) for every done test that carries both."""
    out = []
    for p in card_pages():
        for t in card_tests(p) or []:
            if t.get("state") == "done" and isinstance(t.get("observed"), int) and estimate_of(t):
                out.append((p.stem, t.get("id"), estimate_of(t), t["observed"]))
    return out


def review_agenda():
    """Done tests with an estimate that the morning review has not closed yet: (page, id, doer, estimated, observed)."""
    out = []
    for p in card_pages():
        for t in card_tests(p) or []:
            if t.get("state") == "done" and estimate_of(t) and not t.get("closed"):
                out.append((p.stem, t.get("id"), t.get("doer", ""), estimate_of(t), t.get("observed")))
    return out


def throughput():
    """Observed effort points closed per day, and the average per day since the first close (today included)."""
    per = {}
    for p in card_pages():
        for t in card_tests(p) or []:
            if t.get("closed") and isinstance(t.get("observed"), int):
                per[str(t["closed"])] = per.get(str(t["closed"]), 0) + t["observed"]
    if not per:
        return per, 0.0
    days = (datetime.date.today() - datetime.date.fromisoformat(min(per))).days + 1
    return per, round(sum(per.values()) / days, 1)


def split_tests(page, ids, slug_):
    """Move planned tests off a page that cannot close today onto a new todo page (same owner, linked back)."""
    p = root / "experiments" / f"{page}.md"
    ids = [i for i in ids.split(",") if i]
    tests = {t.get("id"): t for t in card_tests(p) or []}
    for i in ids:
        if i not in tests:
            sys.exit(f"no test '{i}' on {page}")
        if tests[i].get("state") != "planned":
            sys.exit(f"test '{i}' is {tests[i].get('state')}; only planned tests move")
    waiting = [k for k, t in tests.items() if k not in ids and set(t.get("after") or []) & set(ids)]
    if waiting:
        sys.exit(f"{', '.join(waiting)} wait on tests that would move; move them too or drop the wait")
    lines = p.read_text().split("\n")
    moved, kept = [], []
    for ln in lines:
        m = re.match(r"\s+- \{id: ([\w-]+)\b", ln)
        if m and m.group(1) in ids:
            moved.append(re.sub(r",?\s*after: \[[^\]]*\]", lambda a: _keep_after(a.group(0), ids), ln))
        else:
            kept.append(ln)
    if len(moved) != len(ids):
        sys.exit("a test is not a one-line entry; move it by hand")
    f = front(p)
    today = datetime.date.today().isoformat()
    new = root / "experiments" / f"{today}-{slug_}.md"
    if new.exists():
        sys.exit(f"{new.name} exists")
    owner = f.get("owner")
    title = slug_.replace("-", " ").capitalize()
    new.write_text("\n".join([
        "---", f"parent: {HUBS['future']}", f"nav: \"{title}\"", f"date: {today}", "status: todo",
        *([f"owner: {owner}"] if owner else []), *([f"topic: {f['topic']}"] if f.get("topic") else []),
        f"from: {page}", "tense: future",
        "card:", "  tests:", *moved, "---", "", f"# {title}", "",
        f"Split from [{page}](./{page}): these tests did not fit the day. Plan them, vote, then start.", ""]))
    p.write_text("\n".join(kept))
    print(f"moved {', '.join(ids)} to {new.relative_to(root)} (todo); {page} keeps the rest")


def _keep_after(text, moved):
    """Drop `after` waits that point at tests staying on the old page; keep waits among the moved ones."""
    ids = [i.strip() for i in re.search(r"\[([^\]]*)\]", text).group(1).split(",") if i.strip()]
    ids = [i for i in ids if i in moved]
    return f", after: [{', '.join(ids)}]" if ids else ""


def close_tests(refs):
    """Mark `page/id` tests closed today by the review (they move to the past list)."""
    today = datetime.date.today().isoformat()
    for ref in refs:
        stem, tid = ref.rsplit("/", 1)
        path = next(p for p in card_pages() if p.stem == stem)
        text = path.read_text()
        new, n = re.subn(r"(\{id: %s\b[^}\n]*?)(\})" % re.escape(tid), r"\1, closed: %s\2" % today, text, count=1)
        if not n:
            raise SystemExit(f"no inline test {tid} on {stem}")
        path.write_text(new)
        print(f"closed {ref}")


def ask(args):
    """--ask <doer> "<text>" <ticket> [--from <asker>]: a request as a test in the doer's queue, so it is followed up."""
    asker = args[args.index("--from") + 1] if "--from" in args else "unknown"
    if "--from" in args:
        del args[args.index("--from"):args.index("--from") + 2]
    doer, text, stem = args
    path = next(p for p in card_pages() if p.stem == stem)
    text_all = path.read_text()
    _, qdata = queues(datetime.date.today())
    rank = max([i["rank"] for i in qdata.get(doer, []) if isinstance(i["rank"], int) and i["rank"] < 99] or [0]) + 1
    tid = "ask" + re.sub(r"\W", "", text.lower())[:12]
    line = f'    - {{id: {tid}, name: "{text.replace(chr(34), chr(39))}", state: planned, doer: {doer}, rank: {rank}, askedBy: {asker}, date: {datetime.date.today().isoformat()}}}\n'
    new, n = re.subn(r"(\n  tests:\n(?:    - .*\n)+)", lambda m: m.group(1) + line, text_all, count=1)
    if not n:
        raise SystemExit(f"{stem} has no card tests list")
    path.write_text(new)
    print(f"asked {doer} on {stem}: {tid} (rank {rank})")


def effort_plots(qdata):
    """Open weight per agent, from the queue. The vote history itself is ADR's <VoteHistory /> over votes.json."""
    agents = sorted(qdata)
    totals = [sum(i["weight"] for i in qdata[a] if isinstance(i.get("weight"), int)) for a in agents]
    pairs = effort_pairs()
    per, avg = throughput()
    return {"effort-throughput.json": {"data": [{"type": "bar", "x": sorted(per), "y": [per[d] for d in sorted(per)]}],
                                        "layout": {"title": f"Effort closed per review day (average {avg} points per day)",
                                                   "yaxis": {"title": "observed points"}}},
            "effort-load.json": {"data": [{"type": "bar", "x": agents, "y": totals}],
            "layout": {"title": "Open weight per agent", "yaxis": {"title": "sum of weights"}}},
            "effort-observed.json": {"data": [
                {"type": "scatter", "mode": "lines", "x": [0, 21], "y": [0, 21], "name": "observed = estimated", "line": {"dash": "dot"}},
                {"type": "scatter", "mode": "markers", "x": [e for _, _, e, _ in pairs], "y": [o for _, _, _, o in pairs],
                 "text": [f"{i} ({pg})" for pg, i, _, _ in pairs], "name": "done tests"}],
                "layout": {"title": "Estimated and observed effort", "xaxis": {"title": "estimated (vote)"}, "yaxis": {"title": "observed (owner)"}}}}


def page_link(stem):
    if stem.startswith("/"):
        return f"[{stem}](.{stem})"
    for d in ("experiments", "workstreams"):
        if (root / d / f"{stem}.md").exists():
            return f"[{stem}](./{d}/{stem})"
    return stem


def cell(s):
    return str(s).replace("|", "\\|")


def open_threads(stem):
    """Open addressed threads on an experiment page (from ADR's threads.json)."""
    tj = root / "threads.json"
    if not tj.exists():
        return []
    return [t for t in json.loads(tj.read_text()) if t["page"].removesuffix(".html").rstrip("/").endswith(f"/{stem}")]


def blocking_threads(stem):
    """Open threads that keep a done page in review: only those opened before it was done.
    A thread opened on a past page does not reopen it."""
    state = root / ".status-state.json"
    done_at = json.loads(state.read_text()).get("_done_at", {}).get(stem) if state.exists() else None
    if not done_at:
        return open_threads(stem)
    stamp = lambda x: datetime.datetime.fromisoformat(x.replace("Z", "+00:00"))
    return [t for t in open_threads(stem) if stamp(t["at"]) <= stamp(done_at)]


def verdict_block(p):
    """The verdict from the card as a block under the page's title, or None."""
    v = verdict_of(p)
    if not isinstance(v, dict) or verdict_problem(v):
        return None
    return f"<!-- verdict -->\n**Conclusion ({v['result']}, {v['confidence']}):** {v['claim']}\n<!-- /verdict -->\n"


def sync_verdicts(check):
    """Keep the generated verdict block in each page that has a structured verdict. Returns stale pages."""
    stale = []
    for p in sorted((root / "experiments").glob("*.md")):
        s = p.read_text()
        block = verdict_block(p)
        s2 = re.sub(r"(^# .*\n)\n+(?=<!-- verdict -->)", r"\1", VMARK.sub("", s), flags=re.M) if "<!-- verdict -->" in s else s
        if block:
            s2 = re.sub(r"^(# .*\n)\n?", lambda m: f"{m.group(1)}\n{block}\n", s2, count=1, flags=re.M)
        if s2 != s:
            stale.append(p.name)
            if not check:
                p.write_text(s2)
                print(f"updated {p.name}")
    return stale


def load():
    entries, errors, soft = [], [], []
    agents = roster()
    staged = staged_pages()
    free = free_mode()
    must = lambda p, msg: (errors if p.name in staged and not free else soft).append(msg)
    for p in sorted((root / "experiments").glob("*.md")):
        f = front(p)
        miss = [k for k in ("date", "status", "question") if not f.get(k)]
        if f.get("status") in ("done", "abandoned") and not verdict_of(p):
            miss.append("verdict")
        if miss:
            must(p, f"{p.relative_to(root)}: missing {', '.join(miss)}")
        if f.get("status") and f["status"] not in STATUSES:
            must(p, f"{p.relative_to(root)}: status '{f['status']}' not in {'|'.join(STATUSES)}")
        text = p.read_text()
        if f.get("status") in ("done", "abandoned") and not re.search(r"^## What we learned\s*$", text, re.M):
            soft.append(f"{p.relative_to(root)}: {f['status']} needs a '## What we learned' section")
        body = re.search(r"Status: \*\*(\w+)\*\*", text)
        if body and f.get("status") in ("done", "abandoned") and body.group(1) != f["status"]:
            soft.append(f"{p.relative_to(root)}: body says Status **{body.group(1)}**, frontmatter says {f['status']}")
        idea = f.get("status") == "todo"
        if not f.get("owner") and not idea:
            must(p, f"{p.relative_to(root)}: missing owner (one agent name)")
        elif not f.get("owner"):
            pass
        elif not isinstance(f["owner"], str):
            must(p, f"{p.relative_to(root)}: owner must be a single name")
        elif f["owner"] not in agents:
            must(p, f"{p.relative_to(root)}: owner '{f['owner']}' is not on team.md (use one of: {', '.join(sorted(agents))})")
        if "participants" in f and not isinstance(f["participants"], list):
            must(p, f"{p.relative_to(root)}: participants must be a list: [name, name]")
        elif any(x not in agents for x in f.get("participants", []) + [f.get("reviewer", HUMAN)]):
            soft.append(f"{p.relative_to(root)}: participants must be team.md slugs (alpha-agent, not a harness name)")
        if not re.search(r"^card:", text, re.M) and not idea:
            must(p, f"{p.relative_to(root)}: no card: block (add tests with ids)")
        for t in card_tests(p) or []:
            if t.get("state") == "done" and estimate_of(t) and t.get("observed") not in FIB:
                must(p, f"{p.relative_to(root)}: test '{t.get('id')}' is done and estimated {estimate_of(t)}; add `observed: {'|'.join(map(str, FIB))}` (the effort it took)")
        slugs = {re.sub(r"\s+", "-", re.sub(r"[^\w\s-]", "", h.replace("`", "").lower()).strip())
                 for h in re.findall(r"^#{1,6} (.+)$", text, re.M)}
        for t in card_tests(p) or []:
            if str(t.get("link", "")).startswith("#") and t["link"][1:] not in slugs:
                soft.append(f"{p.relative_to(root)}: test '{t.get('id')}' links to {t['link']}, no such heading")
        for m in check_tests(p, f, datetime.date.today()):
            (must if "has no id" in m else lambda _p, x: soft.append(x))(p, m)
        if not re.search(r"^  gist:\s*\S", text, re.M) and not idea:
            must(p, f"{p.relative_to(root)}: card has no gist (one line: what this page is for)")
        bad_start = start_problems(p, f)
        was = subprocess.run(["git", "show", f"HEAD:{p.relative_to(root)}"], cwd=root, capture_output=True, text=True).stdout
        if f.get("status") in ("running", "review") and not page_voted(p) and not re.search(r"^status: (running|review|done|abandoned)\s*$", was, re.M):
            bad_start = bad_start + ["the vote (voted: true in the front matter, once all agents agree)"]
        if f.get("status") == "planned" and any(t.get("state") == "running" for t in card_tests(p) or []):
            must(p, f"{p.relative_to(root)}: planned, so no test may run; it needs the vote again after a return")
        if f.get("status") == "planned" and not page_voted(p) and started_tests(p):
            before = len(re.findall(r"state: (?:done|running)\b", was))
            now = len(re.findall(r"state: (?:done|running)\b", text))
            msg = f"{p.relative_to(root)}: planned and not voted, yet test(s) {', '.join(map(str, started_tests(p)))} are under way or done; vote the page first (voted: true)"
            if now > before:
                must(p, msg)
            else:
                soft.append(msg)
        img = r"!\[[^\]]*\]\(/data/[^)]*\.(?:png|jpe?g)\)"
        if len(re.findall(img, text)) > len(re.findall(img, was)):
            soft.append(f"{p.relative_to(root)}: a new image under /data/ was added; a result plot belongs in a <Plot> on a catalog run (dark theme, tied to the test's Check slot), not a matplotlib image")
        if bad_start and f.get("status") in ("planned", "running", "review"):
            must(p, f"{p.relative_to(root)}: status {f['status']} needs {', '.join(bad_start)}; it cannot leave todo or planned without them")
        elif bad_start and f.get("status") == "todo" and started_tests(p):
            must(p, f"{p.relative_to(root)}: todo, so no test may run yet ({', '.join(map(str, started_tests(p)))}); add {', '.join(bad_start)} first")
        was_done = re.search(r"^status: (done|abandoned)\s*$", was, re.M)
        held = blocking_threads(p.stem) if was_done else open_threads(p.stem)
        if f.get("status") in ("done", "abandoned") and held:
            must(p, f"{p.relative_to(root)}: {len(held)} open thread(s) on this page; it cannot be {f['status']} until they are resolved")
        if f.get("status") == "done" and unbuilt_nodes(p):
            must(p, f"{p.relative_to(root)}: graph nodes not built ({', '.join(unbuilt_nodes(p))}); mark them ☑ or put them on a dashed edge")
        if f.get("status") in ("done", "abandoned"):
            bad = verdict_problem(verdict_of(p))
            if bad:
                must(p, f"{p.relative_to(root)}: {bad}")
        if f.get("date") and not re.fullmatch(r"\d{4}-\d\d-\d\d", f["date"]):
            must(p, f"{p.relative_to(root)}: date '{f['date']}' is not YYYY-MM-DD")
        entries.append((p.stem, f))
    entries.sort(key=lambda e: (e[1].get("date", ""), e[0]), reverse=True)
    if os.environ.get("EXP_STRICT"):
        errors += soft
    else:
        for m in soft:
            print("warning:", m, file=sys.stderr)
    return entries, errors


def table(entries, opts):
    want = opts.get("topic", opts.get("parent"))
    rows = [e for e in entries if want is None or e[1].get("topic", e[1].get("parent")) == want]
    head = ["Date", "Status", "Entry"] + (["Section"] if want is None else []) + ["Owner", "Question", "Verdict"]
    out = ["| " + " | ".join(head) + " |", "|" + " --- |" * len(head)]
    for stem, f in rows:
        row = [f.get("date", ""), f"**{f.get('status', '')}**", f"[{cell(f.get('nav', stem))}](./experiments/{stem})"]
        if want is None:
            par = f.get("topic", f.get("parent", ""))
            pf = root / f"{par}.md"
            row.append(f"[{cell(front(pf).get('nav', par))}](./{par})" if pf.exists() else cell(par))
        row += [cell(f.get("owner", "")), cell(f.get("question", "")), cell((lambda v: v.get("claim", "") if isinstance(v, dict) else v or "")(verdict_of(root / "experiments" / f"{stem}.md")))]
        out.append("| " + " | ".join(row) + " |")
    return "\n".join(out)


def main():
    check = "--check" in sys.argv
    if "--collect" in sys.argv:
        collect()
        return
    if "--purge-dry" in sys.argv:
        for p in purge_trash(dry=True):
            print(p.relative_to(root))
        return
    if "--agenda" in sys.argv:
        for pg, i, doer, est, obs in review_agenda():
            print(f"{pg}/{i}\t{doer}\testimated {est}\tobserved {obs if obs else 'MISSING'}")
        return
    if "--split" in sys.argv:
        a = sys.argv[sys.argv.index("--split") + 1:]
        split_tests(a[0], a[1], a[2])
        return
    if "--mode" in sys.argv:
        a = sys.argv[sys.argv.index("--mode") + 1:]
        f = root / "work-mode.json"
        if a and a[0] in ("free", "gated"):
            f.write_text(json.dumps({"mode": a[0], "since": datetime.datetime.now().astimezone().isoformat(timespec="seconds")}, indent=2) + "\n")
        print(f.read_text() if f.exists() else '{"mode": "gated"}')
        return
    if "--freeze" in sys.argv:
        a = sys.argv[sys.argv.index("--freeze") + 1:]
        f = root / "freeze.json"
        if a and a[0] == "on":
            f.write_text(json.dumps({"active": True, "reason": " ".join(a[1:]) or "freeze", "since": datetime.datetime.now().astimezone().isoformat(timespec="seconds")}, indent=2) + "\n")
        elif a and a[0] == "off":
            f.write_text(json.dumps({"active": False}, indent=2) + "\n")
        print(f.read_text() if f.exists() else '{"active": false}')
        return
    if "--ask" in sys.argv:
        ask(sys.argv[sys.argv.index("--ask") + 1:])
        return
    if "--close" in sys.argv:
        close_tests(sys.argv[sys.argv.index("--close") + 1:])
        return
    entries, errors = load()
    errors += [f"experiments/{n}: verdict block is stale; run python3 tools/exp_index.py" for n in sync_verdicts(check)]
    for page in sorted(root.glob("*.md")):
        s = page.read_text()
        new = MARK.sub(lambda m: f"<!-- experiments {m.group(1)} -->\n{table(entries, json.loads(m.group(1)))}\n<!-- /experiments -->", s)
        new = TMARK.sub(tests_state, new)
        errors += [f"{page.name}: {e}" for e in BAD_MARKS]
        BAD_MARKS.clear()
        if new != s:
            if check:
                errors.append(f"{page.name}: experiment table is stale; run python3 tools/exp_index.py")
            else:
                page.write_text(new)
                print(f"updated {page.name}")
    team = root / "team.md"
    ts = team.read_text()
    qtable, qdata = queues(datetime.date.today())
    tn = QMARK.sub(lambda m: f"<!-- queues -->\n{qtable}\n<!-- /queues -->", ts)
    qj = root / "queues.json"
    qtext = jsonlines.dumps(qdata)
    if not qj.exists() or qj.read_text() != qtext:
        if check:
            errors.append("queues.json is stale; run python3 tools/exp_index.py")
        else:
            qj.write_text(qtext)
            print("updated queues.json")
    if tn != ts:
        if check:
            errors.append("team.md: queue table is stale; run python3 tools/exp_index.py")
        else:
            team.write_text(tn)
            print("updated team.md")
    for name, fig in effort_plots(qdata).items():
        fp = root / "public" / "plots" / name
        ftext = json.dumps(fig, indent=1) + "\n"
        if not fp.exists() or fp.read_text() != ftext:
            if check:
                errors.append(f"public/plots/{name} is stale; run python3 tools/exp_index.py")
            else:
                fp.write_text(ftext)
                print(f"updated public/plots/{name}")
    for e in errors:
        print("error:", e, file=sys.stderr)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
