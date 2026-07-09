#!/usr/bin/env python3
"""
Rebuild territories.json from Cliopatria (Seshat, CC BY 4.0) — the Roman
family at WAR-LEVEL temporal resolution: 253 shapes vs the previous 35
benchmark snapshots (Cannae, Actium, Trajan's east, the year-by-year fall
of the West, Justinian's reconquest, the Arab conquests).

Mapping: Roman Kingdom/Republic/Empire/Western → id 'rome';
         Eastern Roman/Byzantine → id 'eastern-empire'.
Final 'lost' snapshots preserve the fall-recede animations (476 West,
1453 Constantinople). Shapes starting after 1453 are dropped.

Replaces the historical-basemaps-derived set (GPL-3.0) with CC BY 4.0 data.
"""
import json, os
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic


SRC = "/private/tmp/cliopatria_polities_only.geojson"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "data", "territories", "territories.json")
MAX_YEAR = 1453

WEST = {"Roman Kingdom", "Roman Republic", "Roman Empire", "Western Roman Empire"}
EAST = {"Eastern Roman Empire", "Byzantine Empire"}

def round2(c):
    if isinstance(c[0], (int, float)):
        return [round(c[0], 2), round(c[1], 2)]
    return [round2(x) for x in c]

def fmt(y):
    return f"{-y} BC" if y < 0 else f"{y} AD"

clio = json.load(open(SRC))
snaps = []
for f in clio["features"]:
    p = f["properties"]
    name = p["Name"]
    if name in WEST:
        tid, ctrl = "rome", "roman-state"
    elif name in EAST:
        tid, ctrl = "eastern-empire", "constantinople"
    else:
        continue
    fy = int(p["FromYear"])
    if fy > MAX_YEAR:
        continue
    snaps.append({
        "id": tid,
        "year": fy,
        "controlledBy": ctrl,
        "status": "controlled",
        "label": f"{name} — {fmt(fy)}",
        "boundaries": {
            "type": "Feature",
            "properties": {"name": f"{name} {fmt(fy)}"},
            "geometry": {"type": f["geometry"]["type"], "coordinates": round2(f["geometry"]["coordinates"])},
        },
        "_to": int(p["ToYear"]),
    })

# fall snapshots: reuse the final shape of each line, status 'lost'
west = max((s for s in snaps if s["id"] == "rome"), key=lambda s: s["year"])
east = max((s for s in snaps if s["id"] == "eastern-empire" and s["year"] <= 1453), key=lambda s: s["year"])
snaps.append({**west, "year": 476, "status": "lost",
              "label": "Fall of the Western Roman Empire — 476 AD"})
snaps.append({**east, "year": 1453, "status": "lost",
              "label": "Fall of Constantinople — 1453 AD"})

for s in snaps:
    s.pop("_to", None)
snaps.sort(key=lambda s: (s["year"], s["id"]))
dump_atomic(snaps, OUT, ensure_ascii=False, separators=(",", ":"))
open(OUT, "a").write("\n")
west_n = sum(1 for s in snaps if s["id"] == "rome")
east_n = sum(1 for s in snaps if s["id"] == "eastern-empire")
print(f"territories.json: {len(snaps)} snapshots (rome {west_n}, eastern {east_n}) "
      f"{os.path.getsize(OUT)//1024//1024}.{os.path.getsize(OUT)//1024%1024//103} MB")
yrs = sorted({s['year'] for s in snaps})
print(f"  temporal breakpoints: {len(yrs)} (was 33)")
print(f"  sample around Cannae: {[y for y in yrs if -230 <= y <= -200]}")
print(f"  sample Justinian: {[y for y in yrs if 525 <= y <= 565]}")
