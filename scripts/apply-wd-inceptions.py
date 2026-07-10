#!/usr/bin/env python3
"""Tighten Pleiades period-floor dates to Wikidata inceptions.

The Pleiades ingest set constructionYear/startYear from *period* starts,
so the Baths of Diocletian (built 298) carry -30 and label the map at
117 AD. registry/wd-inceptions.json (fetch-wd-inceptions.py) holds the
real P571/P1619 year per QID; this pass raises a record's start to the
inception when that is later — dates only ever tighten, never loosen.

Guards:
  - only in-window years (-800..1453) are applied. Post-1500 inceptions
    are the rebuild-QID identity class resolve-rebuild-counterparts.py
    owns — records it resolved "kept" have a known-bad P571 and are
    excluded here.
  - an inception past the record's own end year is an identity conflict
    (medieval tower on ancient remains), not a date fix: reported to
    review/wd-inception-conflicts.json, record untouched.

Rerunnable and order-independent; wired into data-hygiene.sh.
"""

import glob
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from atomic_json import dump_atomic

BASE = Path(__file__).resolve().parent.parent / "src" / "data"
WINDOW = (-800, 1453)

inceptions = json.load(open(BASE / "registry" / "wd-inceptions.json"))

# Secondary source: the curated Pleiades description often states the
# build date in prose ("constructed under Diocletian from 298-306 CE")
# where Wikidata has no P571 at all. Construction verbs only — no
# "restored" (a restoration year would erase earlier existence) — and
# slashed years ("erected in 335/4 BC") are rejected outright rather
# than half-parsed.
DESC_DATE = re.compile(
    r"(?:constructed|built|erected|dedicated|completed|begun|commissioned"
    r"|inaugurated)\b[^.;]{0,60}?"
    r"(?:\b(?:in|from|around|circa|ca\.?|about)\s+)?"
    r"(?<![\d/])(\d{1,4})(?![\d/])(?:\s*[–—-]\s*\d{1,4})?\s*(BCE?|CE|AD)\b",
    re.I,
)


def description_year(text):
    m = DESC_DATE.search(text or "")
    if not m:
        return None
    y = int(m.group(1))
    if m.group(2).upper().startswith("B"):
        y = -y
    return y

# Curated dates for records neither Wikidata nor the description can
# place (registry/date-overrides.json). Applied with authority: an
# override may move a span in either direction and set the end year —
# it exists precisely for the identity cases the automatic guards
# refuse to touch.
overrides = {}  # keyed by qid AND by bare record id — some targets lack a qid
ov_path = BASE / "registry" / "date-overrides.json"
if ov_path.exists():
    for o in json.load(open(ov_path)):
        if o.get("qid"):
            overrides[o["qid"]] = o
        if o.get("id"):
            overrides[str(o["id"])] = o


def bare_id(rec_id):
    return re.sub(r"^[a-z-]+:(pleiades-)?", "", str(rec_id or ""))


def override_for(p):
    return overrides.get(p.get("qid")) or overrides.get(bare_id(p.get("id")))

# QIDs whose P571 is a known rebuild/registration artifact — never apply
kept_bad_p571 = set()
review = BASE / "review" / "anachronistic-qids.json"
if review.exists():
    for r in json.load(open(review)):
        if str(r.get("resolution", "")).startswith("kept"):
            kept_bad_p571.add(r.get("qid"))


def usable_year(qid, description=None):
    y = inceptions.get(qid) if qid and qid not in kept_bad_p571 else None
    if y is None:
        y = description_year(description)
    if y is None or not (WINDOW[0] <= y <= WINDOW[1]):
        return None
    return y


# buildings.json records that predate the QID backfill can borrow the
# QID their unified sibling carries — same entity, ids match modulo the
# "building:"/"pleiades-" prefixes, and silo cleanup already propagated
# swarm verdicts there.
sibling_qid = {}
for silo in ("building.json", "aqueduct.json", "amphitheater.json"):
    d = json.load(open(BASE / "unified" / silo))
    for it in d if isinstance(d, list) else d.get("features", []):
        p = it.get("properties", it)
        if not p.get("qid"):
            continue
        bare = re.sub(r"^[a-z-]+:(pleiades-)?", "", str(p.get("id", "")))
        sibling_qid.setdefault(bare, p["qid"])


conflicts = []
applied = []


def conflict(path, rec_id, name, qid, y, start, end):
    conflicts.append(
        {
            "file": str(path.relative_to(BASE)),
            "id": rec_id,
            "name": name,
            "qid": qid,
            "inception": y,
            "recordSpan": [start, end],
            "why": "inception past record end — identity, not date (rebuild-QID class)",
        }
    )


# ── buildings.json: constructionYear / attestedFrom / attestedTo ──────
bpath = BASE / "buildings" / "buildings.json"
buildings = json.load(open(bpath))
b_changed = 0
qid_backfilled = 0
for b in buildings:
    qid = b.get("qid")
    if not qid and str(b["id"]) in sibling_qid:
        qid = b["qid"] = sibling_qid[str(b["id"])]
        qid_backfilled += 1
    ov = override_for(b)
    if ov:
        before = (b.get("constructionYear"), b.get("attestedFrom"), b.get("attestedTo"))
        b["constructionYear"] = b["attestedFrom"] = ov["start"]
        if "end" in ov:
            b["attestedTo"] = ov["end"]
        if before != (b["constructionYear"], b["attestedFrom"], b.get("attestedTo")):
            applied.append((b.get("name"), qid, before[0], ov["start"]))
            b_changed += 1
        continue
    y = usable_year(qid, b.get("description"))
    if y is None:
        continue
    cur = b.get("constructionYear")
    if cur is not None and y <= cur:
        continue
    end = b.get("attestedTo")
    if end not in (None, 0) and y > end:
        conflict(bpath, b["id"], b.get("name"), qid, y, cur, end)
        continue
    b["constructionYear"] = y
    if b.get("attestedFrom") is not None and b["attestedFrom"] < y:
        b["attestedFrom"] = y
    applied.append((b.get("name"), qid, cur, y))
    b_changed += 1
if b_changed or qid_backfilled:
    dump_atomic(buildings, bpath)
print(
    f"buildings.json: {b_changed} construction years tightened, "
    f"{qid_backfilled} QIDs backfilled from unified siblings"
)

# ── unified/*.json: startYear / endYear ───────────────────────────────
u_changed = 0
for f in sorted(glob.glob(str(BASE / "unified" / "*.json"))):
    fpath = Path(f)
    data = json.load(open(f))
    items = data if isinstance(data, list) else data.get("features", [])
    changed = 0
    for it in items:
        p = it.get("properties", it)
        ov = override_for(p)
        if ov:
            before = (p.get("startYear"), p.get("endYear"))
            p["startYear"] = ov["start"]
            if "end" in ov:
                p["endYear"] = ov["end"]
            if before != (p["startYear"], p.get("endYear")):
                applied.append((p.get("name"), p.get("qid"), before[0], ov["start"]))
                changed += 1
            continue
        y = usable_year(p.get("qid"), p.get("description"))
        if y is None:
            continue
        start = p.get("startYear")
        if start is not None and y <= start:
            continue
        end = p.get("endYear")
        if end not in (None, 0) and y > end:
            conflict(fpath, p.get("id"), p.get("name"), p.get("qid"), y, start, end)
            continue
        p["startYear"] = y
        applied.append((p.get("name"), p.get("qid"), start, y))
        changed += 1
    if changed:
        dump_atomic(data, fpath)
        print(f"{fpath.name}: {changed} start years tightened")
    u_changed += changed

dump_atomic(conflicts, BASE / "review" / "wd-inception-conflicts.json")
print(
    f"total: {b_changed + u_changed} applied, {len(conflicts)} conflicts "
    f"-> review/wd-inception-conflicts.json"
)
for name, qid, old, new in applied[:15]:
    print(f"  {name} ({qid}): {old} -> {new}")
