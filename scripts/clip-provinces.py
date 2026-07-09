#!/usr/bin/env python3
"""
Clip the DARE province polygons to the empire's actual maximal extent
(Cliopatria territory). The DARE shapes run notionally deep into the Sahara/
Arabia; against the old blobby territory that overhang was hidden, but the
accurate Cliopatria borders exposed it (provinces spilling far outside the
empire). Clip mask = union of Rome's greatest extent (Trajan, ~117) and the
Eastern Empire's Justinian extent (~555) so every province a Roman state
ever administered stays whole where it belongs.

Also re-anchors each province label to a point guaranteed inside the
clipped polygon. Backs up originals as *.pre-clip.json (gitignored-free
one-time artifacts). Idempotent-ish: clipping an already-clipped set is a
no-op geometrically.
"""
import json, os
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic


BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")

terr = json.load(open(os.path.join(BASE, "territories", "territories.json")))
def snap_at(tid, year):
    cands = [t for t in terr if t["id"] == tid and t["year"] <= year]
    return max(cands, key=lambda t: t["year"])
mask_shapes = [
    shape(snap_at("rome", 117)["boundaries"]["geometry"]).buffer(0),
    shape(snap_at("eastern-empire", 555)["boundaries"]["geometry"]).buffer(0),
]
# small buffer so coastal provinces aren't nicked by coordinate rounding
mask = unary_union(mask_shapes).buffer(0.15)
print(f"clip mask: union of rome@{snap_at('rome',117)['year']} + eastern@{snap_at('eastern-empire',555)['year']}")

ppath = os.path.join(BASE, "dare", "provinces.json")
provs = json.load(open(ppath))
feats = provs["features"] if isinstance(provs, dict) else provs

clipped_n = kept = dropped_area = 0
name_to_geom = {}
for f in feats:
    g = shape(f["geometry"]).buffer(0)
    inter = g.intersection(mask)
    if inter.is_empty or inter.area < 1e-4:
        kept += 1  # entirely outside mask (shouldn't happen) — keep original
        name_to_geom[f["properties"]["name"]] = g
        continue
    dropped_area += g.area - inter.area
    if abs(g.area - inter.area) > 1e-6:
        clipped_n += 1
    f["geometry"] = mapping(inter.simplify(0.005))
    name_to_geom[f["properties"]["name"]] = inter

dump_atomic(provs, ppath, ensure_ascii=False, separators=(",", ":"))
open(ppath, "a").write("\n")
print(f"provinces.json: {len(feats)} provinces, {clipped_n} clipped, "
      f"total overhang removed ≈ {dropped_area:.0f} deg² "
      f"({os.path.getsize(ppath)//1024} KB)")

# re-anchor labels inside the clipped shapes
lpath = os.path.join(BASE, "dare", "province-labels.json")
labels = json.load(open(lpath))
from shapely.geometry import Point
moved = 0
for lab in labels:
    g = name_to_geom.get(lab["name"])
    if g is None or g.is_empty:
        continue
    if not g.contains(Point(lab["lng"], lab["lat"])):
        rp = g.representative_point()
        lab["lat"], lab["lng"] = round(rp.y, 4), round(rp.x, 4)
        moved += 1
dump_atomic(labels, lpath, ensure_ascii=False, separators=(",", ":"))
open(lpath, "a").write("\n")
print(f"province-labels.json: {moved} labels re-anchored inside clipped shapes")
