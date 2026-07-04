#!/usr/bin/env python3
"""
Replace the crude rome@476 "fall" polygon (a ruler-straight box over N. Italy +
a Tunisia block, missing the Italian core) with the Ostrogoths polygon from
historical-basemaps world_500.geojson — Italy/Dalmatia, i.e. Odoacer's kingdom,
which is what the fallen West actually was in 476. Idempotent.

Usage: python3 scripts/fix-fall-territory.py
"""
import json, urllib.request, os

URL = "https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson/world_500.geojson"
PATH = os.path.join(os.path.dirname(__file__), "..", "src", "data", "territories", "territories.json")

def round2(c):
    if isinstance(c[0], (int, float)):
        return [round(c[0], 2), round(c[1], 2)]
    return [round2(x) for x in c]

world = json.load(urllib.request.urlopen(URL))
ostro = next(f for f in world["features"]
             if (f["properties"].get("NAME") or f["properties"].get("name")) == "Ostrogoths")
geom = {"type": ostro["geometry"]["type"], "coordinates": round2(ostro["geometry"]["coordinates"])}

d = json.load(open(PATH))
t = next(x for x in d if x["id"] == "rome" and x["year"] == 476)
old = t["boundaries"]["geometry"]
oldpolys = len(old["coordinates"]) if old["type"] == "MultiPolygon" else 1
t["boundaries"] = {
    "type": "Feature",
    "properties": {"name": "Western Roman Empire 476 AD (fallen — Italy under Odoacer)"},
    "geometry": geom,
}
json.dump(d, open(PATH, "w"), ensure_ascii=False, indent=2)
open(PATH, "a").write("\n")
npts = sum(len(r) for p in (geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]) for r in p)
print(f"✓ rome@476: {oldpolys} crude polys -> Ostrogoth Italy ({geom['type']}, {npts} pts)")
