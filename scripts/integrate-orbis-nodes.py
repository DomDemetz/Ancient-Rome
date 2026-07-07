#!/usr/bin/env python3
"""
Join ORBIS trade sites onto canonical place nodes (places.json), same
pattern as the dare/vici attributions: one node, many dataset memberships.

- Matched place nodes gain  orbis: {"id": <orbisId>, "type": <siteType>}
- Matched orbis sites (orbis.json + orbis-temporal.json) gain  node: <placeId>
- Provenance goes to registry/crosswalk-orbis.json

Match tiers (validated 2026-07-07: 392 name+coord, 175 coord-only, ~65 pure
sea/river junctions stay unlinked — they are network topology, not places):
  1. normalized-name overlap AND nearest node within 5 km
  2. nearest node within 2 km regardless of name (name-variant sites)

Idempotent: strips prior orbis/node fields before re-matching.
"""
import json
import math
import os

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")


def load(rel):
    with open(os.path.join(BASE, rel)) as f:
        return json.load(f)


def save(rel, data):
    path = os.path.join(BASE, rel)
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
        f.write("\n")
    print(f"  wrote {rel} ({os.path.getsize(path) // 1024} KB)")


def norm(s):
    return s.lower().replace("-", " ").strip()


def km(lat1, lng1, lat2, lng2):
    return math.hypot((lat1 - lat2) * 111.0, (lng1 - lng2) * 111.0 * math.cos(math.radians(lat1)))


places = load("places/places.json")
for p in places:
    p.pop("orbis", None)

grid = {}
for p in places:
    grid.setdefault((round(p["lat"] * 4), round(p["lng"] * 4)), []).append(p)


def nearest(lat, lng):
    k0, k1 = round(lat * 4), round(lng * 4)
    best, bd = None, float("inf")
    for dk in range(-2, 3):
        for dl in range(-2, 3):
            for p in grid.get((k0 + dk, k1 + dl), ()):
                d = km(lat, lng, p["lat"], p["lng"])
                if d < bd:
                    best, bd = p, d
    return best, bd


def names_overlap(a, b):
    a, b = norm(a), norm(b)
    return a == b or a in b or b in a


sites_by_file = {rel: load(rel) for rel in ("trade/orbis.json", "trade/orbis-temporal.json")}
orbis_sites = sites_by_file["trade/orbis-temporal.json"]["sites"]

crosswalk = {}
claimed = {}  # placeId -> (orbisId, km): node carries only its closest orbis site
stats = {"name": 0, "coord": 0, "unmatched": 0}
for s in orbis_sites:
    p, d = nearest(s["lat"], s["lng"])
    method = None
    if p is not None and d < 5.0 and names_overlap(s["name"], p["name"]):
        method = "name"
    elif p is not None and d < 2.0:
        method = "coord"
    if method is None:
        stats["unmatched"] += 1
        continue
    stats[method] += 1
    crosswalk[s["id"]] = {"node": p["id"], "km": round(d, 2), "method": method}
    prev = claimed.get(p["id"])
    if prev is None or d < prev[1]:
        claimed[p["id"]] = (s["id"], d)

by_id = {p["id"]: p for p in places}
site_types = {s["id"]: s["siteType"] for s in orbis_sites}
for place_id, (orbis_id, _d) in claimed.items():
    by_id[place_id]["orbis"] = {"id": orbis_id, "type": site_types[orbis_id]}

for rel, data in sites_by_file.items():
    for s in data["sites"]:
        s.pop("node", None)
        hit = crosswalk.get(s["id"])
        if hit:
            s["node"] = hit["node"]
    save(rel, data)

save("places/places.json", places)
save("registry/crosswalk-orbis.json", dict(sorted(crosswalk.items())))

print(
    f"orbis join: {len(crosswalk)}/{len(orbis_sites)} sites linked "
    f"(name {stats['name']}, coord {stats['coord']}, unlinked {stats['unmatched']}); "
    f"{len(claimed)} place nodes carry orbis attribution"
)
