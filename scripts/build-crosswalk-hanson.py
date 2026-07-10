#!/usr/bin/env python3
"""
Build a crosswalk mapping Hanson city IDs → canonical place node keys.

Matching strategy (same as the Chandler/Modelski crosswalks):
  1. Name + proximity: normalize names, find DARE/Pleiades nodes within 15 km
  2. Coordinate proximity alone for close matches (<5 km, same-era)

Output: src/data/registry/crosswalk-hanson.json
  { "hanson-roma": {"key": "pl-423025", "dist_km": 0.3}, ... }
"""
import json, math, os, re
from collections import defaultdict

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")

hanson_all = json.load(open(os.path.join(BASE, "cities", "historical-cities.json")))
hanson = [h for h in hanson_all if h.get("source") == "hanson-oxrep"]
dare = json.load(open(os.path.join(BASE, "dare", "settlements.json")))
pleiades = json.load(open(os.path.join(BASE, "pleiades-all.json")))
xw_dare = json.load(open(os.path.join(BASE, "registry", "crosswalk-dare.json")))

def haversine(lat1, lng1, lat2, lng2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * 6371 * math.asin(min(1, math.sqrt(h)))

def normalize(name):
    name = re.sub(r"\s*\([^)]*\)", "", name)
    name = re.sub(r"[^a-z]+", "", name.lower())
    return name

# Build lookup: DARE nodes with their canonical keys
dare_nodes = []
for s in dare:
    did = str(s["id"])
    pid = xw_dare.get(did, {}).get("pid")
    key = f"pl-{pid}" if pid else f"dare-{did}"
    dare_nodes.append({
        "key": key,
        "name": normalize(s.get("name", "")),
        "modern": normalize(s.get("modern", "")),
        "lat": s["lat"],
        "lng": s["lng"],
        "major": s.get("major", False),
    })

# Spatial index for fast lookup
grid = defaultdict(list)
for d in dare_nodes:
    gy, gx = int(d["lat"] // 1), int(d["lng"] // 1)
    grid[(gy, gx)].append(d)

crosswalk = {}
matched, unmatched = 0, 0

for h in hanson:
    hname = normalize(h["name"])
    hlat, hlng = h["lat"], h["lng"]
    gy, gx = int(hlat // 1), int(hlng // 1)

    candidates = []
    for dy in range(-1, 2):
        for dx in range(-1, 2):
            candidates.extend(grid.get((gy + dy, gx + dx), []))

    best, best_dist, best_score = None, 999, -1
    for d in candidates:
        dist = haversine(hlat, hlng, d["lat"], d["lng"])
        if dist > 20:
            continue
        name_match = (hname == d["name"]) or (hname == d["modern"]) or (
            hname and d["name"] and (hname in d["name"] or d["name"] in hname))
        score = (name_match * 10) + (d["major"] * 2) + max(0, 15 - dist)
        if score > best_score or (score == best_score and dist < best_dist):
            best, best_dist, best_score = d, dist, score

    if best and (best_score >= 10 or best_dist < 3):
        crosswalk[h["id"]] = {
            "key": best["key"],
            "dist_km": round(best_dist, 1),
        }
        matched += 1
    else:
        unmatched += 1

out = os.path.join(BASE, "registry", "crosswalk-hanson.json")
with open(out, "w") as f:
    json.dump(crosswalk, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"Hanson crosswalk: {matched} matched, {unmatched} unmatched, {len(hanson)} total")
print(f"  Wrote {os.path.relpath(out)} ({os.path.getsize(out) // 1024} KB)")
