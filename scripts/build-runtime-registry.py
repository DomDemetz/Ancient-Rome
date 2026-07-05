#!/usr/bin/env python3
"""
Derive the two SMALL registry artifacts the app loads at runtime:

- registry/dare-suppression.json  {dareId: [start, end]} — a DARE settlement
  that is the same place as a Chandler city (shared Pleiades pid) is hidden
  while its labeled, population-sized Chandler twin is on screen. Kills the
  Rome-has-two-dots problem without losing coverage outside the twin's years.
- registry/chandler-qid.json      {chandlerId: qid} — for popup Wikidata links.

Inputs: the crosswalks (build-place-crosswalks.py). Idempotent.
"""
import json, os
from collections import defaultdict

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")
R = os.path.join(BASE, "registry")

xw_ch = json.load(open(os.path.join(R, "crosswalk-chandler.json")))
xw_da = json.load(open(os.path.join(R, "crosswalk-dare.json")))
cities = {c["id"]: c for c in json.load(open(os.path.join(BASE, "cities", "historical-cities.json")))}

by_pid = defaultdict(list)
for did, e in xw_da.items():
    by_pid[e["pid"]].append(did)

suppress = {}
qids = {}
for cid, e in xw_ch.items():
    c = cities[cid]
    if e.get("qid"):
        qids[cid] = e["qid"]
    for did in by_pid.get(e["pid"], []):
        suppress[did] = [c["startYear"], c["endYear"]]

p1 = os.path.join(R, "dare-suppression.json")
json.dump(suppress, open(p1, "w"), sort_keys=True)
open(p1, "a").write("\n")
p2 = os.path.join(R, "chandler-qid.json")
json.dump(qids, open(p2, "w"), sort_keys=True)
open(p2, "a").write("\n")
print(f"dare-suppression.json: {len(suppress)} twins ({os.path.getsize(p1)} B)")
print(f"chandler-qid.json: {len(qids)} cities with QIDs ({os.path.getsize(p2)} B)")


# --- cities-search.json: tiny eager manifest for the search bar ---
# name/lat/lng + [startYear, endYear] clamped to the atlas window, plus the
# year of peak population WITHIN the window (search jumps there when the city
# doesn't exist at the current year). Cities entirely outside the window are
# excluded.
MIN_YEAR, MAX_YEAR = -753, 1453
search = []
for c in cities.values():
    pts = [p for p in c["populations"] if MIN_YEAR <= p["year"] <= MAX_YEAR]
    if not pts and c["startYear"] > MAX_YEAR:
        continue  # founded after the atlas window
    if not pts:
        # attested only outside the window but alive inside it (interpolated)
        if c["endYear"] < MIN_YEAR or c["startYear"] > MAX_YEAR:
            continue
        peak_year = max(MIN_YEAR, min(MAX_YEAR, c["startYear"]))
    else:
        peak_year = max(pts, key=lambda p: p["population"])["year"]
    search.append({
        "id": c["id"],
        "n": c["name"],
        "lat": c["lat"],
        "lng": c["lng"],
        "s": max(c["startYear"], MIN_YEAR),
        "e": min(c["endYear"], MAX_YEAR),
        "p": peak_year,
    })
p3 = os.path.join(R, "cities-search.json")
json.dump(search, open(p3, "w"), ensure_ascii=False, separators=(",", ":"))
open(p3, "a").write("\n")
print(f"cities-search.json: {len(search)} cities ({os.path.getsize(p3)//1024} KB)")
