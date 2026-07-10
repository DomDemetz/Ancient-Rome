#!/usr/bin/env python3
"""Cap end dates at destruction events (registry/event-caps.json).

The Vesuvius case: Pompeii's Stabian Baths carried attestedTo 2100 and
rendered dots in 1000 AD — the *place* dies in 79 but its buildings ran
on Pleiades period end dates. Each event names a year and the bounding
boxes of the sites it destroyed; every record standing there before the
event (start <= year) gets its end capped to it.

Caps only ever LOWER an end date; records that begin after the event
(post-eruption reoccupation, modern-era entries) are untouched.
Rerunnable; wired into data-hygiene.sh next to apply-wd-inceptions.
"""

import glob
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from atomic_json import dump_atomic

BASE = Path(__file__).resolve().parent.parent / "src" / "data"

events = json.load(open(BASE / "registry" / "event-caps.json"))


contradictions = []


def cap_year(la, lo, start, rec=None):
    for ev in events:
        hit = any(
            b["south"] <= la <= b["north"] and b["west"] <= lo <= b["east"]
            for b in ev["boxes"]
        )
        if not hit:
            continue
        if start is not None and start not in (0,) and start > ev["year"]:
            # a structure "built" after its site was destroyed is a date
            # error upstream (the Pompeii Odeon carried a Flavian floor of
            # 81) — surface it instead of guessing
            if rec is not None:
                contradictions.append({**rec, "event": ev["event"], "eventYear": ev["year"]})
            continue
        return ev["year"]
    return None


total = 0

# buildings.json: attestedTo (and constructionYear stays)
bpath = BASE / "buildings" / "buildings.json"
buildings = json.load(open(bpath))
n = 0
for b in buildings:
    la, lo = b.get("lat"), b.get("lng")
    if la is None or lo is None:
        continue
    y = cap_year(la, lo, b.get("constructionYear"),
                 {"file": "buildings/buildings.json", "id": b.get("id"),
                  "name": b.get("name"), "start": b.get("constructionYear")})
    if y is None:
        continue
    end = b.get("attestedTo")
    if end is None or end == 0 or end > y:
        b["attestedTo"] = y
        n += 1
    # attestedTo is period semantics the layer ignores; destroyedYear is
    # the explicit "this stopped existing" the layer filters on
    if b.get("destroyedYear") != y:
        b["destroyedYear"] = y
        n += 1
if n:
    dump_atomic(buildings, bpath)
print(f"buildings.json: {n} end dates capped")
total += n

# amphitheaters.json has no end field at all — destroyedYear only
apath = BASE / "amphitheaters" / "amphitheaters.json"
amphs = json.load(open(apath))
n = 0
for a in amphs:
    la, lo = a.get("lat"), a.get("lng")
    if la is None or lo is None:
        continue
    y = cap_year(la, lo, a.get("constructionYear"),
                 {"file": "amphitheaters/amphitheaters.json", "id": a.get("id"),
                  "name": a.get("name"), "start": a.get("constructionYear")})
    if y is not None and a.get("destroyedYear") != y:
        a["destroyedYear"] = y
        n += 1
if n:
    dump_atomic(amphs, apath)
print(f"amphitheaters.json: {n} destroyed years set")
total += n

# every other startYear/endYear silo the map or a build step reads —
# the first cut only covered unified/* and the Regio nodes, vici sites,
# DARE settlements and ancient ports kept dotting Pompeii in 200 AD.
# pleiades-all/idai are source snapshots, but entity merges take spans
# from them, so an uncapped snapshot resurrects the ghosts on rebuild.
GENERIC = (
    ["unified/*.json", "vici/*.json"],
    [
        "places/places.json",
        "places/places-detail.json",
        "religion/religion-pleiades.json",
        "vici-sites.json",
        "dare/settlements.json",
        "ancient-ports.json",
        "pleiades-all.json",
        "idai-sites.json",
    ],
)
paths = sorted(
    {p for g in GENERIC[0] for p in glob.glob(str(BASE / g))}
    | {str(BASE / f) for f in GENERIC[1] if (BASE / f).exists()}
)
for f in paths:
    d = json.load(open(f))
    items = d if isinstance(d, list) else d.get("features", [])
    n = 0
    for it in items:
        p = it.get("properties", it)
        if not isinstance(p, dict):
            continue
        la, lo = p.get("lat"), p.get("lng")
        if not isinstance(la, (int, float)) or not isinstance(lo, (int, float)):
            continue
        rel = str(Path(f).relative_to(BASE))
        y = cap_year(la, lo, p.get("startYear"),
                     {"file": rel, "id": p.get("id"),
                      "name": p.get("name"), "start": p.get("startYear")})
        if y is None:
            continue
        end = p.get("endYear")
        if end is None or end == 0 or end > y:
            p["endYear"] = y
            n += 1
        # unified/* also feeds the legacy Building/Amphitheater loaders,
        # which drop endYear in the mapping — destroyedYear survives it
        if str(Path(f).parent.name) == "unified" and p.get("destroyedYear") != y:
            p["destroyedYear"] = y
            n += 1
    if n:
        dump_atomic(d, Path(f))
        print(f"{Path(f).relative_to(BASE)}: {n} end dates capped")
    total += n

dump_atomic(contradictions, BASE / "review" / "event-cap-contradictions.json")
print(f"total: {total} records capped, {len(contradictions)} contradictions "
      f"-> review/event-cap-contradictions.json")
