#!/usr/bin/env python3
"""One-shot hygiene pass from the 2026-07-07 data audit.

  1. places.json: drop dots whose display name is a raw QID (Q1234...) —
     an unlabeled dot is texture, a QID-labeled dot is a bug on screen.
  2. cross-reference.json: prune orphaned wd-* entries — worldwide-settlement
     records whose map dot was removed by the pre-1500 filter (Singapore,
     Dubai, ...). They are unreachable from the map and pollute search.
  3. Point fixes found by validate-entities.py:
     - DARE 32631 / pl-206989 (Bucium): name is a bare space -> use modern name
     - DARE 46636 / pl-580080 (Plakoto): startYear 550 is a BC/AD sign error
       (Pleiades attests 550 BC) -> -550
"""

import json
import re
from pathlib import Path
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic


DATA = Path(__file__).resolve().parent.parent / "src" / "data"
QID_NAME = re.compile(r"^Q\d+$")

places_path = DATA / "places" / "places.json"
places = json.load(open(places_path))
n0 = len(places)
dropped_qid_dots = [x["id"] for x in places if QID_NAME.match(str(x.get("name", "")))]
places = [x for x in places if not QID_NAME.match(str(x.get("name", "")))]

for x in places:
    if x["id"] == "pl-206989" and not x.get("name", "").strip():
        x["name"] = x.get("modern", "Bucium")
    if x["id"] == "pl-580080" and x.get("startYear") == 550:
        x["startYear"] = -550

dump_atomic(places, places_path, ensure_ascii=False, separators=(",", ":"))
print(f"places.json: {n0} -> {len(places)} (dropped {len(dropped_qid_dots)} QID-named dots)")

dare_path = DATA / "dare" / "settlements.json"
dare = json.load(open(dare_path))
for x in dare:
    if str(x["id"]) == "32631" and not x.get("name", "").strip():
        x["name"] = x.get("modern", "Bucium")
    if str(x["id"]) == "46636" and x.get("startYear") == 550:
        x["startYear"] = -550
dump_atomic(dare, dare_path, ensure_ascii=False, separators=(",", ":"))
print("dare/settlements.json: fixed Bucium name, Plakoto BC/AD sign")

cr_path = DATA / "wiki" / "cross-reference.json"
cr = json.load(open(cr_path))
place_ids = {str(x["id"]) for x in places}
before = len(cr)
orphans = [k for k in cr if k.startswith("wd-") and k not in place_ids]
for k in orphans:
    del cr[k]
dump_atomic(cr, cr_path, ensure_ascii=False, indent=1)
print(f"cross-reference.json: {before} -> {len(cr)} (pruned {len(orphans)} orphaned wd-* entries)")
