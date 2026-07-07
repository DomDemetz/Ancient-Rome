#!/usr/bin/env python3
"""
Clip polity shapes to the real coastline (Natural Earth 50m land, public
domain). Cliopatria polygons carry their own coarse coast that disagrees
with the basemap — fills bled into the sea and border strokes traced the
wrong coastline. After this step, sea edges ARE the coastline.

Applies to empires.json and territories.json (so Rome and its rivals
agree). Runs inside build-data after their generators. Idempotent
(clipping clipped shapes is a geometric no-op).
"""
import json, os, sys, time
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
from shapely.strtree import STRtree
from shapely.prepared import prep

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")
LAND_SRC = "/private/tmp/ne_50m_land.json"

t0 = time.time()
land_fc = json.load(open(LAND_SRC))
# pre-simplify the mask: 0.015 deg ≈ 1.5 km — invisible at our zooms,
# keeps fjord coastlines from exploding the output size
land_geoms = [shape(f["geometry"]).buffer(0).simplify(0.015) for f in land_fc["features"]]
tree = STRtree(land_geoms)
print(f"land mask: {len(land_geoms)} polygons loaded in {time.time()-t0:.1f}s")

def clip(geom):
    """Intersect with land polygons near the shape (STRtree-pruned)."""
    idx = tree.query(geom)
    if len(idx) == 0:
        return geom  # far inland already / no land near?? keep as-is
    near = unary_union([land_geoms[i] for i in idx])
    out = geom.intersection(near)
    return out if not out.is_empty else geom

def round2(c):
    if isinstance(c[0], (int, float)):
        return [round(c[0], 2), round(c[1], 2)]
    return [round2(x) for x in c]

# --- empires.json ---
p = os.path.join(BASE, "empires", "empires.json")
empires = json.load(open(p))
n = 0
for e in empires:
    g = shape(e["geometry"]).buffer(0)
    c = clip(g)
    if not c.equals(g):
        e["geometry"] = json.loads(json.dumps(mapping(c.simplify(0.015))))
        e["geometry"]["coordinates"] = round2(e["geometry"]["coordinates"])
        n += 1
json.dump(empires, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
open(p, "a").write("\n")
print(f"empires.json: {n}/{len(empires)} shapes coast-clipped ({os.path.getsize(p)//1024//1024} MB) in {time.time()-t0:.0f}s")

# --- territories.json ---
p = os.path.join(BASE, "territories", "territories.json")
terr = json.load(open(p))
n = 0
for t in terr:
    g = shape(t["boundaries"]["geometry"]).buffer(0)
    c = clip(g)
    if not c.equals(g):
        gm = mapping(c.simplify(0.012))
        gm = json.loads(json.dumps(gm))
        gm["coordinates"] = round2(gm["coordinates"])
        t["boundaries"]["geometry"] = gm
        n += 1
json.dump(terr, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
open(p, "a").write("\n")
print(f"territories.json: {n}/{len(terr)} snapshots coast-clipped ({os.path.getsize(p)//1024//1024} MB) in {time.time()-t0:.0f}s")
