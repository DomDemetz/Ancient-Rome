#!/usr/bin/env python3
"""CHGIS v6 prefecture points → registry/chgis-prefectures.json.

Source: Harvard/Fudan CHGIS v6 time-series prefecture points (EULA:
attribution required, raw data not redistributed — the shapefile stays in
gitignored downloads/; only this derived registry ships).

CHGIS models each administrative incarnation as its own record (Baode Jun
1005-1181 → Baode Zhou 1182-1374, same seat). The atlas wants one dated
dot per seat: instances at identical coordinates merge into one node
spanning min(BEG_YR)..max(END_YR), named by the instance that held the
seat longest within the atlas window.

Requires pyshp (not in the system python):
  python3 -m venv /tmp/chgis-venv && /tmp/chgis-venv/bin/pip install pyshp
  /tmp/chgis-venv/bin/python3 scripts/ingest-chgis.py
"""

import json
from collections import defaultdict
from pathlib import Path
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic

import shapefile

DATA = Path(__file__).resolve().parent.parent / "src" / "data"
SHP = DATA / "downloads" / "chgis-pref" / "v6_time_pref_pts_utf_wgs84.shp"
ATLAS_END = 1453


def main():
    r = shapefile.Reader(str(SHP))
    seats = defaultdict(list)
    for sr in r.iterShapeRecords():
        d = sr.record.as_dict()
        if not d.get("BEG_YR") or d["BEG_YR"] > ATLAS_END:
            continue
        lng, lat = sr.shape.points[0]
        seats[(round(lat, 3), round(lng, 3))].append(d)

    out = []
    for (lat, lng), insts in seats.items():
        insts.sort(key=lambda d: d["BEG_YR"])
        start = min(d["BEG_YR"] for d in insts)
        end = max(d["END_YR"] or ATLAS_END for d in insts)
        # name by the longest-lived incarnation inside the atlas window
        def span_in_window(d):
            return min(d["END_YR"] or ATLAS_END, ATLAS_END) - d["BEG_YR"]
        best = max(insts, key=span_in_window)
        name = (best.get("NAME_PY") or "").strip()
        if not name:
            continue
        # CHGIS records sub-year existences as END < BEG (Wenshan Jun
        # 559-558) — read as a one-year existence, never invert
        if end and end < start:
            end = start
        out.append({
            "id": f"chgis-{best.get('SYS_ID') or f'{lat}-{lng}'}",
            "name": name,
            "nameZh": (best.get("NAME_CH") or "").strip() or None,
            "type": (best.get("TYPE_PY") or "").strip() or None,
            "lat": lat,
            "lng": lng,
            "startYear": start,
            "endYear": min(end, ATLAS_END) if end else 0,
        })

    out.sort(key=lambda x: x["id"])
    dump_atomic(out, DATA / "registry" / "chgis-prefectures.json",
                ensure_ascii=False, separators=(",", ":"))
    print(f"chgis-prefectures.json: {len(out)} seats "
          f"from {len(r)} instances (window <= {ATLAS_END})")


if __name__ == "__main__":
    main()
