#!/usr/bin/env python3
"""
Ingest Cliopatria (Seshat Global History Databank, CC BY 4.0) — world polity
shapes with validity windows and Wikidata IDs — as the atlas's Empires layer.

GLOBAL coverage on purpose (the "atlas of all human history" direction): no
geographic filter. Only cap: the polity's validity must overlap the atlas
time window (753 BC – 1453 AD). The Roman states themselves are excluded —
our curated fine-grained territory remains authoritative for Rome/Byzantium —
and "(Alliance …)"/"(Allegiance …)" relationship meta-records are dropped.

Source: github.com/Seshat-Global-History-Databank/cliopatria (v0.2.0)
Output: src/data/empires/empires.json
"""
import json, os, re

SRC = "/private/tmp/cliopatria_polities_only.geojson"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "data", "empires", "empires.json")
MIN_YEAR, MAX_YEAR = -753, 1453
EXCLUDE = {
    "Roman Kingdom", "Roman Republic", "Roman Empire",
    "Eastern Roman Empire", "Western Roman Empire", "Byzantine Empire",
}

def ring_centroid(ring):
    """Shoelace centroid of a polygon exterior ring [[lng,lat],...]."""
    a = cx = cy = 0.0
    for i in range(len(ring) - 1):
        x0, y0 = ring[i]
        x1, y1 = ring[i + 1]
        f = x0 * y1 - x1 * y0
        a += f
        cx += (x0 + x1) * f
        cy += (y0 + y1) * f
    if abs(a) < 1e-9:
        return ring[0]
    return [cx / (3 * a), cy / (3 * a)]

def label_point(geom):
    """Anchor for the polity label: centroid of the largest polygon."""
    if geom["type"] == "Polygon":
        ring = geom["coordinates"][0]
    else:
        ring = max((p[0] for p in geom["coordinates"]), key=len)
    lng, lat = ring_centroid(ring)
    return [round(lat, 2), round(lng, 2)]

def round2(c):
    if isinstance(c[0], (int, float)):
        return [round(c[0], 2), round(c[1], 2)]
    return [round2(x) for x in c]

def dedupe_rings(coords, typ):
    """After rounding, collapse consecutive duplicate points."""
    def clean_ring(ring):
        out = []
        for pt in ring:
            if not out or pt != out[-1]:
                out.append(pt)
        if len(out) >= 2 and out[0] != out[-1]:
            out.append(out[0])
        return out
    if typ == "Polygon":
        return [clean_ring(r) for r in coords]
    return [[clean_ring(r) for r in poly] for poly in coords]

d = json.load(open(SRC))
out, skipped_time, skipped_meta = [], 0, 0
for f in d["features"]:
    p = f["properties"]
    name = p["Name"].strip()
    if name.startswith("("):
        skipped_meta += 1
        continue
    if name in EXCLUDE:
        continue
    try:
        fy, ty = int(p["FromYear"]), int(p["ToYear"])
    except (TypeError, ValueError):
        continue
    if ty < MIN_YEAR or fy > MAX_YEAR:
        skipped_time += 1
        continue
    g = f["geometry"]
    coords = dedupe_rings(round2(g["coordinates"]), g["type"])
    geom = {"type": g["type"], "coordinates": coords}
    rec = {
        "id": re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") + f"-{fy}",
        "name": name,
        "from": fy,
        "to": ty,
        "area": int(float(p.get("Area") or 0)),  # km²
        "label": label_point(geom),
        "geometry": geom,
    }
    if p.get("Wikidata"):
        rec["qid"] = p["Wikidata"]
    if p.get("Wikipedia"):
        rec["wp"] = p["Wikipedia"]
    if p.get("MemberOf"):
        rec["memberOf"] = p["MemberOf"]
    out.append(rec)

# big polities first so small ones draw on top
def area(r):
    return sum(1 for _ in str(r["geometry"]["coordinates"]))  # cheap proxy: string length
out.sort(key=lambda r: -len(json.dumps(r["geometry"])))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
open(OUT, "a").write("\n")
names = {r["name"] for r in out}
qids = sum(1 for r in out if "qid" in r)
print(f"empires.json: {len(out)} polity shapes, {len(names)} distinct polities, {qids} with QIDs")
print(f"  window overlap kept; skipped {skipped_time} out-of-window + {skipped_meta} meta-records")
print(f"  size: {os.path.getsize(OUT)//1024//1024} MB")
for probe in ("Sasanian Empire", "Abbasid Caliphate", "Carthage", "Han Dynasty", "Maurya Empire", "Mongol Empire"):
    hits = [r for r in out if r["name"] == probe]
    print(f"  {probe:18} shapes: {len(hits)}  {'✓' if hits else 'MISSING'}")
