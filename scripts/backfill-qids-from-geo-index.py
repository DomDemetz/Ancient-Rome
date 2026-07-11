#!/usr/bin/env python3
"""Backfill QIDs from the local Wikidata geo-index (name+coord+type match).

For entity-table rows without a QID: adopt the index entity whose label
matches the row's name exactly (case-insensitive) AND whose coordinates
sit within ~10km AND whose P31 types don't contradict the row's kind.
Ambiguity (two candidates in range) means no match — identity needs to be
boring. Output: registry/qid-backfill-geo.json {entity id -> qid}, which
build-entity-table.py folds into rows on the next build.
"""

import json
from pathlib import Path
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic

DATA = Path(__file__).resolve().parent.parent / "src" / "data"
INDEX = DATA / "downloads" / "wikidata-geo-index.json"

# P31 classes that mean "this QID is a PLACE, not a structure" — matching
# one to a structure row is containment (the temple named after the village
# 3km away), not identity. Audit 2026-07-11 showed the coarse first guard
# let roads match towns and temples match villages — the contradiction set
# now covers all settlement-ish classes plus geographic features, applies
# to every non-settlement kind, and non-settlement rows must ALSO match
# within ~3km (structures are points; only settlements sprawl).
PLACE_CLASSES = {
    "Q486972", "Q515", "Q3957", "Q532", "Q15284", "Q5084",  # settlement/city/town/village/municipality/hamlet
    "Q954172", "Q123705", "Q1115575", "Q2514025",  # frazione, neighborhood, civil parish, populated place
    "Q23442", "Q23397", "Q54050", "Q8502", "Q133056",  # island, lake, hill, mountain, mountain pass
    "Q4022", "Q47521",  # river, stream
}
SETTLEMENT_KINDS = {"settlement", "farm", "oppidum"}
import re
PLACE_DESC = re.compile(
    r"\b(village|town|city|commune|municipality|community|district|"
    r"neighbou?rhood|island|lake|mountain|hill|pass|river|stream|suburb|"
    r"parish|county|region|province|mahalle|quarter|resort|locality|settlement)\b", re.I)


def main():
    if not INDEX.exists():
        print("geo-index not present — skipping")
        return
    print("loading geo-index...")
    idx = json.load(open(INDEX))
    label_map = {}
    for q, v in idx.items():
        l = (v.get("label") or "").lower()
        if l:
            label_map.setdefault(l, []).append(q)

    table = json.load(open(DATA / "entities" / "entity-table.json"))
    out = {}
    ambiguous = contradicted = 0
    for e in table:
        if e.get("qid") or not e.get("name") or e.get("lat") is None:
            continue
        cands = label_map.get(e["name"].lower())
        if not cands:
            continue
        is_settlement = e["kind"] in SETTLEMENT_KINDS
        tol_lat, tol_lng = (0.1, 0.13) if is_settlement else (0.03, 0.04)
        near = []
        for q in cands:
            v = idx[q]
            if abs(v["lat"] - e["lat"]) < tol_lat and abs(v["lng"] - e["lng"]) < tol_lng:
                near.append(q)
        if len(near) != 1:
            ambiguous += len(near) > 1
            continue
        q = near[0]
        types = set(idx[q].get("types") or [])
        if not is_settlement and types & PLACE_CLASSES:
            contradicted += 1
            continue
        # description backstop: country-specific place classes (French
        # commune, Turkish köy...) escape any finite P31 set — the English
        # desc names them consistently
        if not is_settlement and PLACE_DESC.search(idx[q].get("desc") or ""):
            contradicted += 1
            continue
        out[e["id"]] = q

    dump_atomic(out, DATA / "registry" / "qid-backfill-geo.json",
                ensure_ascii=False, separators=(",", ":"))
    print(f"backfilled {len(out)} QIDs "
          f"(skipped {ambiguous} ambiguous, {contradicted} type-contradicted)")


if __name__ == "__main__":
    main()
