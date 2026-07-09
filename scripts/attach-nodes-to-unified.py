#!/usr/bin/env python3
"""
JOIN THE TWO ENTITY SYSTEMS (ENTITY-MODEL.md, step: unified ↔ nodes).

The atlas has two entity layers that don't reference each other:
  - canonical place nodes (places.json): identity-merged settlements with
    population curves, wiki knowledge, geographic context
  - unified typed points (unified/*.json): ports, temples, battles, mines…

This build step computes, for every unified entity, the canonical place it
belongs to, writing registry/unified-nodes.json:

    { "<unifiedId>": {"node": "<nodeId>", "name": "<nodeName>", "km": 3.2,
                      "rel": "same" | "at"} }

Match rules, in order:
  1. IDENTITY ("same"): entity QID == node QID  →  the entity IS the place
     (e.g. a religious-site record that is the town itself).
  2. LOCATION ("at"): nearest settlement-grade node within 8 km — a
     settlement-typed DARE node, a major, or a population city. Battles are
     given 25 km (fought NEAR a place, named after it).

Registry artifact only — chunks are untouched, so the join survives chunk
regeneration. Shipwrecks are skipped (they belong to the sea).
Consumers: popup/panel adoption listed on the workbench board.
"""
import glob, json, math, os
from collections import defaultdict
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic


BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")
SKIP_TYPES = {"shipwreck"}
AT_RADIUS_KM = {"battle": 25.0}
DEFAULT_RADIUS = 8.0

def km(a, b):
    (la1, lo1), (la2, lo2) = a, b
    p1, p2 = math.radians(la1), math.radians(la2)
    dp, dl = math.radians(la2 - la1), math.radians(lo2 - lo1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371 * math.asin(min(1, math.sqrt(h)))

places = json.load(open(os.path.join(BASE, "places", "places.json")))

# settlement-grade nodes only: real towns, not aqueduct segments or forts
SETTLEMENT_TYPES = {11, 12, 13}
anchors = []
for p in places:
    grade = (
        p.get("populations")
        or (p.get("dare", {}).get("major"))
        or (p.get("dare", {}).get("type") in SETTLEMENT_TYPES)
    )
    if grade:
        anchors.append(p)
qid_to_node = {}
grid = defaultdict(list)
for p in anchors:
    grid[(int(p["lat"] // 1), int(p["lng"] // 1))].append(p)
for p in places:
    if p.get("qid") and p["qid"] not in qid_to_node:
        qid_to_node[p["qid"]] = p

def nearest_anchor(lat, lng, radius):
    """Prefer a real city (major / population node) over a nearer minor
    site — 'at Nicopolis (6 km)' beats 'at Ormos Vathy 1 (4 km)'."""
    gy, gx = int(lat // 1), int(lng // 1)
    best, bd, bmaj = None, radius, False
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            for p in grid.get((gy + dy, gx + dx), []):
                d = km((lat, lng), (p["lat"], p["lng"]))
                if d >= radius:
                    continue
                major = bool(p.get("populations") or p.get("dare", {}).get("major"))
                if (major, -d) > (bmaj, -bd):
                    best, bd, bmaj = p, d, major
    return best, bd

out = {}
stats = defaultdict(lambda: [0, 0, 0])  # type -> [total, same, at]
for path in sorted(glob.glob(os.path.join(BASE, "unified", "*.json"))):
    tname = os.path.basename(path)[:-5]
    if tname.replace("discovery-", "") in SKIP_TYPES or tname in SKIP_TYPES:
        continue
    entities = json.load(open(path))
    radius = AT_RADIUS_KM.get(tname, DEFAULT_RADIUS)
    for e in entities:
        stats[tname][0] += 1
        node = None
        rel = None
        if e.get("qid") and e["qid"] in qid_to_node:
            node, d, rel = qid_to_node[e["qid"]], 0.0, "same"
        else:
            node, d = nearest_anchor(e["lat"], e["lng"], radius)
            rel = "at" if node else None
        if node:
            out[e["id"]] = {
                "node": node["id"],
                "name": node["name"],
                "km": round(d, 1),
                "rel": rel,
            }
            stats[tname][1 if rel == "same" else 2] += 1

path = os.path.join(BASE, "registry", "unified-nodes.json")
dump_atomic(out, path, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
open(path, "a").write("\n")

total = same = at = 0
for t, (n, s_, a_) in sorted(stats.items()):
    total += n; same += s_; at += a_
    print(f"  {t:22} {n:6}  same {s_:5}  at {a_:5}  joined {100*(s_+a_)//max(1,n):3}%")
print(f"unified-nodes.json: {len(out)} of {total} entities joined "
      f"({same} identity, {at} location) — {os.path.getsize(path)//1024} KB")

# gold checks
def show(uid):
    print(f"  GOLD {uid:34} -> {out.get(uid)}")
for probe in list(out.keys())[:0]:
    pass
import itertools
# find famous entities for gold-checking
amph = json.load(open(os.path.join(BASE, "unified", "amphitheater.json")))
colosseum = next((e for e in amph if "flavian" in e["name"].lower() or "colosseum" in e["name"].lower()), None)
if colosseum:
    show(colosseum["id"])
ports = json.load(open(os.path.join(BASE, "unified", "port.json")))
ostia = next((e for e in ports if "ostia" in e["name"].lower()), None)
if ostia:
    show(ostia["id"])
battles = json.load(open(os.path.join(BASE, "unified", "battle.json")))
actium = next((e for e in battles if "actium" in e["name"].lower()), None)
if actium:
    show(actium["id"])
