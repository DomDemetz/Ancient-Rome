#!/usr/bin/env python3
"""
After the fall of the West (476), the Eastern Empire kept the late-Roman
provincial system until each province actually died — to the Arab conquests,
the Slav/Avar collapse of the Balkans, or the theme-system reform. Extend
each surviving province's endYear to its historical end:

  Arab conquests:   Arabia 636 · Syria 637 · Iudaea 638 · Armenia
                    Mesopotamia 640 · Aegyptus 641 · Creta et Cyrene 643
                    (fall of Cyrenaica) · Cilicia 650 · Cyprus 688
                    (condominium after the raids of 649)
  Balkan collapse:  Moesia Superior 602 · Dalmatia 614 (fall of Salona) ·
                    Macedonia 615 · Achaia 615 · Moesia Inferior 680
                    (Bulgar arrival) · Thracia 680
  Themes replace provinces (~680): Asia · Bithynia et Pontus ·
                    Galatia et Cappadocia · Lycia et Pamphylia
  Byzantine islands: Sardinia et Corsica 720 · Sicilia 800 (Byzantine to
                    827; capped at the atlas detail horizon)

Western provinces keep 476 (or their earlier real ends: Dacia 271,
Britannia 410). Applied to provinces.json AND province-labels.json.
"""
import json
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic


NEW_END = {
    "Arabia": 636, "Syria": 637, "Iudaea": 638, "Armenia Mesopotamia": 640,
    "Aegyptus": 641, "Creta et Cyrene": 643, "Cilicia": 650, "Cyprus": 688,
    "Moesia Superior": 602, "Dalmatia": 614, "Macedonia": 615, "Achaia": 615,
    "Moesia Inferior": 680, "Thracia": 680,
    "Asia": 680, "Bithynia et Pontus": 680, "Galatia et Cappadocia": 680,
    "Lycia et Pamphylia": 680,
    "Sardinia et Corsica": 720, "Sicilia": 800,
}

for path in ("src/data/dare/provinces.json", "src/data/dare/province-labels.json"):
    d = json.load(open(path))
    recs = d["features"] if isinstance(d, dict) else d
    n = 0
    for r in recs:
        p = r.get("properties", r)
        if p.get("name") in NEW_END:
            p["endYear"] = NEW_END[p["name"]]
            n += 1
    dump_atomic(d, path, ensure_ascii=False, separators=(",", ":"))
    open(path, "a").write("\n")
    print(f"{path}: {n} end-years extended")
