#!/usr/bin/env python3
"""
Ingest DARMC / Mapping Past Societies (Harvard, CC BY-NC-SA 4.0) late-antique
province polygons into the Provinces layer.

The curated provinces.json carries real conquest-dated Principate provinces
but after Diocletian (293) the layer only RELABELED the old geometry via
province-changes.json — the Dominate-era shapes never existed. DARMC has
named polygons for exactly that gap:
  ca. AD 303-324 (97 provinces, with DIOCESE)  -> shown 285-450
  ca. AD 500     (64 provinces, East only)     -> shown 451-640

Curated features and labels are clamped to end 284 so the DARMC snapshots
take over cleanly; the label-split hack in province-changes self-disables
(split labels start 293 but die with their parent features at 284).

Source: harvard-cga.maps.arcgis.com feature services (Roman_World layers
14-16), fetched via .../FeatureServer/{id}/query?f=geojson — see
DATA-SOURCES.md. Files staged at /private/tmp/darmc_provinces_ce*.geojson.
Rerunnable: curated features are recognized by the absence of source=DARMC.
"""
import json, os, re
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data", "dare")
SNAPSHOTS = [
    ("/private/tmp/darmc_provinces_ce303_324.geojson", 285, 450, "ca. AD 303–324"),
    ("/private/tmp/darmc_provinces_ce500.geojson", 451, 640, "ca. AD 500"),
]
CLAMP = 284  # last year the curated Principate set renders

ROMAN_NUMERAL = re.compile(r"^[IVX]+$")

# upstream typos in DARMC PROV_NAME
NAME_FIXES = {"Cartbaginiensis": "Carthaginiensis"}

def display_name(raw):
    """'AEGYPTUS\nIOVIA' -> 'Aegyptus Iovia'; keep numerals ('AQUITANIA II')."""
    words = raw.replace("\n", " ").split()
    out = []
    for w in words:
        if ROMAN_NUMERAL.match(w):
            out.append(w)
        elif w.upper() in ("AND", "ET"):
            out.append(w.lower())
        else:
            out.append(w.capitalize())
    name = " ".join(out)
    return NAME_FIXES.get(name, name)

def round3(c):
    if isinstance(c[0], (int, float)):
        return [round(c[0], 3), round(c[1], 3)]
    return [round3(x) for x in c]

def dedupe(coords, typ):
    def ring(r):
        out = [pt for i, pt in enumerate(r) if i == 0 or pt != r[i - 1]]
        if len(out) >= 2 and out[0] != out[-1]:
            out.append(out[0])
        return out
    if typ == "Polygon":
        return [ring(r) for r in coords]
    return [[ring(r) for r in poly] for poly in coords]

def centroid(geom):
    """Label anchor: shoelace centroid of the largest exterior ring."""
    rings = [geom["coordinates"][0]] if geom["type"] == "Polygon" else [p[0] for p in geom["coordinates"]]
    r = max(rings, key=len)
    a = cx = cy = 0.0
    for i in range(len(r) - 1):
        x0, y0 = r[i]
        x1, y1 = r[i + 1]
        f = x0 * y1 - x1 * y0
        a += f
        cx += (x0 + x1) * f
        cy += (y0 + y1) * f
    if abs(a) < 1e-9:
        return r[0][1], r[0][0]
    return cy / (3 * a), cx / (3 * a)

# --- provinces.json: keep curated Principate set (clamped), append DARMC ---
pp = os.path.join(BASE, "provinces.json")
prov = json.load(open(pp))
curated = [f for f in prov["features"] if f["properties"].get("source") != "DARMC"]
for f in curated:
    p = f["properties"]
    if p.get("endYear") and p["endYear"] > CLAMP:
        p["endYear"] = CLAMP

darmc_features, darmc_labels = [], []
for path, y0, y1, period in SNAPSHOTS:
    d = json.load(open(path))
    for f in d["features"]:
        p = f["properties"]
        name = display_name(p["PROV_NAME"].strip())
        g = f["geometry"]
        geom = {"type": g["type"], "coordinates": dedupe(round3(g["coordinates"]), g["type"])}
        diocese = display_name((p.get("DIOCESE") or "").strip())
        darmc_features.append({
            "type": "Feature",
            "properties": {
                "name": name, "source": "DARMC", "period": period,
                **({"diocese": diocese} if diocese else {}),
                "startYear": y0, "endYear": y1,
            },
            "geometry": geom,
        })
        lat, lng = centroid(geom)
        darmc_labels.append({
            "name": name, "lat": round(lat, 3), "lng": round(lng, 3),
            "startYear": y0, "endYear": y1,
        })

prov["features"] = curated + darmc_features
dump_atomic(prov, pp, ensure_ascii=False, separators=(",", ":"))
open(pp, "a").write("\n")

# --- province-labels.json: clamp curated labels, append DARMC anchors ------
lp = os.path.join(BASE, "province-labels.json")
labels = [l for l in json.load(open(lp)) if not l.get("darmc")]
for l in labels:
    if l.get("endYear", 0) == 0 or l["endYear"] > CLAMP:
        l["endYear"] = CLAMP
for l in darmc_labels:
    l["darmc"] = True
labels += darmc_labels
dump_atomic(labels, lp, ensure_ascii=False, separators=(",", ":"))
open(lp, "a").write("\n")

print(f"provinces.json: {len(curated)} curated (end ≤ {CLAMP}) + {len(darmc_features)} DARMC = {len(prov['features'])} features, {os.path.getsize(pp)//1024} KB")
print(f"province-labels.json: {len(labels)} labels")
for path, y0, y1, period in SNAPSHOTS:
    n = sum(1 for f in darmc_features if f['properties']['startYear'] == y0)
    print(f"  {period}: {n} provinces shown {y0}–{y1}")
