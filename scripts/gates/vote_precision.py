"""Vote precision: the plot of precision per voter and the check that a voted ticket shows it on its vote card.
  python3 tools/vote_precision.py          write public/plots/vote-precision.json from votes.json
  python3 tools/vote_precision.py --check  warn for every ticket with precision votes whose card has no precision column
votes.json is the ADR vote store; a round carries precision: {agent: level} once a voter gave one.
A vote counts as lacking precision only in rounds requested after ADR 0.192.0 added the field."""
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
FIELD_FROM = "2026-11-24T04:47:49Z"
LEVELS = ("high", "medium", "low", "none")


def rounds():
    for item in json.loads((root / "votes.json").read_text()):
        for r in item["rounds"]:
            if r.get("revealed") and r.get("requestedAt", "") >= FIELD_FROM:
                yield item, r


def level(value):
    """Old rounds store a word, rounds from ADR 0.193.0 store σ in steps (1 high, 2 medium, 3 or more low)."""
    if isinstance(value, (int, float)):
        return "high" if value <= 1 else "medium" if value <= 2 else "low"
    return value if value in LEVELS else "none"


def counts():
    per = {}
    for _, r in rounds():
        prec = r.get("precision", {})
        for agent in r["votes"]:
            per.setdefault(agent, dict.fromkeys(LEVELS, 0))[level(prec.get(agent))] += 1
    return per


def plot(per):
    agents = sorted(per)
    return {"data": [{"type": "bar", "name": level, "x": agents, "y": [per[a][level] for a in agents]} for level in LEVELS],
            "layout": {"title": "Votes by stated precision", "barmode": "stack", "yaxis": {"title": "votes"}}}


def cards_without_table():
    """Pages with a precision vote without a <VoteCard /> whose vote card (an info block named Vote) lacks the word precision."""
    missing = set()
    for item, r in rounds():
        if not r.get("precision"):
            continue
        page = root / (item["page"].lstrip("/") + ".md")
        text = page.read_text() if page.exists() else ""
        if "<VoteCard" in text:
            continue
        card = re.search(r"::: info Vote\n(.*?)\n:::", text, re.S)
        if not card or "precision" not in card.group(1).lower():
            missing.add(item["page"])
    return sorted(missing)


if "--check" in sys.argv:
    for page in cards_without_table():
        print(f"warning: {page}: voted with a stated precision, but the vote card shows none")
else:
    per = counts()
    out = root / "public" / "plots" / "vote-precision.json"
    out.write_text(json.dumps(plot(per), indent=1) + "\n")
    votes = sum(sum(c.values()) for c in per.values())
    print(f"{votes} votes stored, {sum(c['none'] for c in per.values())} without precision, "
          f"{len(cards_without_table())} cards without the table")
