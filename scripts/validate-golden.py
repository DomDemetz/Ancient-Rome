#!/usr/bin/env python3
"""Check shipped data files against the hand-verified golden set.

Run after any data pipeline change: python3 scripts/validate-golden.py
Exit 1 on any failure. See src/data/golden/golden-places.json.
"""

import json
import sys
from collections import Counter
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "src" / "data"
COORD_TOL = 0.15

golden = json.load(open(DATA / "golden" / "golden-places.json"))
failures = []


def norm(s):
    return (s or "").strip().lower()


# --- settlements present with correct coords ---
dare = json.load(open(DATA / "dare" / "settlements.json"))
by_name = {}
for x in dare:
    for n in (x.get("name"), x.get("modern")):
        if n:
            by_name.setdefault(norm(n), []).append(x)

for g in golden["settlements"]:
    names = [g["name"]] + g.get("altNames", [])
    candidates = [c for n in names for c in by_name.get(norm(n), [])]
    hit = next((c for c in candidates
                if abs(c["lat"] - g["lat"]) < COORD_TOL
                and abs(c["lng"] - g["lng"]) < COORD_TOL), None)
    if hit is None:
        failures.append(f"settlement missing or mislocated: {g['name']} "
                        f"(expected ~{g['lat']},{g['lng']}; "
                        f"{len(candidates)} name matches)")

# --- battles with correct year ---
battles = json.load(open(DATA / "battles" / "battles.json"))
bat_by_name = {norm(b.get("name")): b for b in battles}
for g in golden["battles"]:
    b = bat_by_name.get(norm(g["name"]))
    if b is None:
        failures.append(f"battle missing: {g['name']}")
    elif abs(b.get("year", 99999) - g["year"]) > g.get("tolerance", 1):
        failures.append(f"battle year wrong: {g['name']} "
                        f"expected {g['year']}, got {b.get('year')}")

# --- records that must NOT be classified as buildings ---
buildings = json.load(open(DATA / "buildings" / "buildings.json"))
bids = {str(b["id"]) for b in buildings}
for g in golden["notBuildings"]:
    if g["pleiadesId"] in bids:
        failures.append(f"non-building present in buildings.json: "
                        f"{g['pleiadesId']} ({g['why']})")

# --- building type distribution sanity ---
types = Counter(b.get("buildingType") for b in buildings)
sanity = golden["buildingTypeSanity"]
for t, cap in sanity["maxCounts"].items():
    if types.get(t, 0) > cap:
        failures.append(f"buildingType '{t}' count {types[t]} exceeds cap {cap} "
                        f"— type mapping likely regressed")
for t in sanity["mustExistTypes"]:
    if types.get(t, 0) == 0:
        failures.append(f"buildingType '{t}' vanished from buildings.json")

# --- fabricated-date epidemic guard ---
share50 = sum(1 for b in buildings if b.get("constructionYear") == 50) / max(len(buildings), 1)
cap = golden["fabricatedDateGuard"]["maxShareConstructionYear50"]
if share50 > cap:
    failures.append(f"constructionYear=50 share {share50:.0%} exceeds {cap:.0%} "
                    f"— the fallback-date bug is back")

if failures:
    print(f"GOLDEN SET: {len(failures)} failure(s)")
    for f in failures:
        print(f"  ✗ {f}")
    sys.exit(1)
print(f"GOLDEN SET: all checks passed "
      f"({len(golden['settlements'])} settlements, {len(golden['battles'])} battles, "
      f"{len(golden['notBuildings'])} negative assertions, type + date guards)")
