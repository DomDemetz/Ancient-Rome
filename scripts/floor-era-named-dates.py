#!/usr/bin/env python3
"""Floor start dates of era-named structures at their eponym's accession.

The Pleiades ingest stamped period-bucket placeholders on undated sites,
and conquest-flooring (floor-estimated-dates.py) can't help inside Italy —
Rome holds Rome from the start. But a building NAMED for its builder dates
itself: Villa Hadriani cannot precede Hadrian (117), the Baths of
Caracalla cannot precede Caracalla (211). This floors startYear at the
eponym's accession year for records dated earlier than that.

Guards: only fires when startYear < accession - 15 (construction can
start a little before formal accession); skipped when an endYear would
contradict the floor; skipped for saint names (Sant'Antonino is not the
Antonines). port.json is excluded entirely — port names are alias lists
across renamings (Theodosia/Caffa was a Greek colony of 600 BC, not a
Theodosian foundation). Idempotent; runs in build-data.sh after
floor-estimated-dates.py.
"""

import glob
import json
import os
import re

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")

# name pattern -> accession/era-start year
ERA_FLOORS = [
    (r"\bflavian\b", 69),
    (r"\btrajan\w*", 98),
    (r"\bhadrian\w*", 117),
    (r"\bantonin\w*", 138),
    (r"\bseveran\b|\bseptimius severus\b", 193),
    (r"\bcaracalla\b|\bantoninianae\b", 211),
    (r"\bvarianus\b", 218),
    (r"\bquintilii\b", 151),
    (r"\bgordian\w*", 238),
    (r"\baurelian\w*", 270),
    (r"\bdiocletian\w*", 284),
    (r"\bconstantin\w*|\bmaxenti\w*", 306),
    (r"\btheodosi\w*", 379),
    (r"\bjustinian\w*", 527),
]
MARGIN = 15
SKIP_FILES = {"port.json"}
SAINT = re.compile(r"\b(san|sant|santa|saint|st)\W*$")
# Pleiades period-bucket end placeholders ("imperial" ends 300, "late
# antique" 640…). When one of these contradicts an era floor, the pair is
# placeholder junk — floor the start, drop the fake end (unknown).
SOFT_ENDS = {300, 500, 640}

def floor_record(e, start_key, end_key):
    name = (e.get("name") or "").lower()
    s = e.get(start_key)
    if s is None:
        return False
    for pat, floor in ERA_FLOORS:
        m = re.search(pat, name)
        if not m:
            continue
        if SAINT.search(name[: m.start()]):
            return False
        end = e.get(end_key)
        if s < floor - MARGIN:
            if end == s:
                # placeholder pair (period-bucket midpoint on both) —
                # move the pair together
                e[start_key] = floor
                e[end_key] = floor
                return True
            if end in (None, 0) or end >= floor:
                e[start_key] = floor
                return True
            if end in SOFT_ENDS:
                e[start_key] = floor
                e.pop(end_key, None)
                return True
        return False
    return False


total = 0
for path in sorted(glob.glob(os.path.join(BASE, "unified", "*.json"))):
    if os.path.basename(path) in SKIP_FILES:
        continue
    d = json.load(open(path))
    if not isinstance(d, list):
        continue
    floored = sum(1 for e in d if floor_record(e, "startYear", "endYear"))
    if floored:
        with open(path, "w") as f:
            json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")
        print(f"  {os.path.basename(path):28} floored {floored}")
        total += floored

# the buildings SOURCE carries the same placeholders — entity-table/search
# take dates from it with source precedence, so floor it too
src = os.path.join(BASE, "buildings", "buildings.json")
d = json.load(open(src))
floored = 0
for e in d:
    hit = floor_record(e, "constructionYear", "attestedTo")
    if floor_record(e, "attestedFrom", "attestedTo") or hit:
        floored += 1
if floored:
    with open(src, "w") as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"  buildings.json (source)      floored {floored}")
    total += floored
print(f"total era-floored: {total}")
