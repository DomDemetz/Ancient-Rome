#!/usr/bin/env python3
"""
Ingest DARMC / Mapping Past Societies (CC BY-NC-SA 4.0) Islamic conquest
phases 622-750 as a thematic overlay: five phase-colored waves that appear
as the timeline crosses each phase's start (temporal.ts: unknown end ->
visible after start; the overlay reads as "extent reached", never retreats).

Source: harvard-cga.maps.arcgis.com FeatureServer, Medieval_World layer 71
("Political Boundaries, 632-750 (Islamic)"), fetched 2026-07-11 via
.../query?f=geojson. Staged at /private/tmp/darmc_islamic_632_750.geojson.
Geometry is modern-coastline precision (~129k vertices); rounded to 2
decimals for an overview overlay.

Output: src/data/dare/islamic-conquests.json (FeatureCollection; properties
phase 1-5, label, startYear).
"""
import json, os
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic

SRC = "/private/tmp/darmc_islamic_632_750.geojson"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "data", "dare", "islamic-conquests.json")

# DARMC "Conquered" text -> (phase order, display label, year the wave starts)
PHASES = {
    "By the death of Mohammed 632": (1, "By the death of Muhammad (632)", 622),
    "Under Abu Bakr 632-634": (2, "Under Abu Bakr (632–634)", 632),
    "Under Omar 634-644": (3, "Under Umar (634–644)", 634),
    "Under Othman 644-656 and Ali 656-661": (4, "Under Uthman and Ali (644–661)", 644),
    "Under Umayyad Caliphate 661-750": (5, "Under the Umayyad Caliphate (661–750)", 661),
}

def round2(c):
    if isinstance(c[0], (int, float)):
        return [round(c[0], 2), round(c[1], 2)]
    return [round2(x) for x in c]

def dedupe(coords, typ):
    def ring(r):
        out = [pt for i, pt in enumerate(r) if i == 0 or pt != r[i - 1]]
        if len(out) >= 2 and out[0] != out[-1]:
            out.append(out[0])
        return out
    if typ == "Polygon":
        return [ring(r) for r in coords]
    return [[ring(r) for r in poly] for poly in coords]

d = json.load(open(SRC))
features = []
for f in d["features"]:
    key = (f["properties"].get("Conquered") or "").strip()
    if key not in PHASES:
        raise SystemExit(f"unknown phase text: {key!r}")
    phase, label, start = PHASES[key]
    g = f["geometry"]
    features.append({
        "type": "Feature",
        "properties": {"phase": phase, "label": label, "startYear": start},
        "geometry": {"type": g["type"], "coordinates": dedupe(round2(g["coordinates"]), g["type"])},
    })
features.sort(key=lambda f: f["properties"]["phase"])

out = {"type": "FeatureCollection", "features": features}
dump_atomic(out, OUT, ensure_ascii=False, separators=(",", ":"))
open(OUT, "a").write("\n")
verts = sum(len(r) for f in features for poly in (
    f["geometry"]["coordinates"] if f["geometry"]["type"] == "MultiPolygon" else [f["geometry"]["coordinates"]]
) for r in poly)
print(f"islamic-conquests.json: {len(features)} features, {verts} vertices, "
      f"{os.path.getsize(OUT)//1024} KB")
for f in features:
    p = f["properties"]
    print(f"  phase {p['phase']}: {p['label']} (from {p['startYear']})")
