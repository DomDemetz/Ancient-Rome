#!/usr/bin/env python3
"""Pair each QID-bearing cross-reference record with its Wikidata ground
truth and write judge-ready chunk files for the verification swarm.

Usage: python3 scripts/build-qid-chunks.py <ground-truth.json> <chunks-dir>
"""

import json
import math
import sys
from pathlib import Path
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic


DATA = Path(__file__).resolve().parent.parent / "src" / "data"
CHUNK_SIZE = 50


def main():
    gt = json.load(open(sys.argv[1]))
    outdir = Path(sys.argv[2])
    outdir.mkdir(parents=True, exist_ok=True)

    cr = json.load(open(DATA / "wiki" / "cross-reference.json"))

    # coords for our records come from the layer files where available
    coords = {}
    for rel, prefix, idf in (("buildings/buildings.json", "building", "id"),
                             ("dare/settlements.json", "settlement", "id")):
        for x in json.load(open(DATA / rel)):
            coords[f"{prefix}:{x[idf]}"] = (x.get("lat"), x.get("lng"))

    records = []
    for key, e in sorted(cr.items()):
        if not e.get("qid") or key.startswith("wd-"):
            continue
        g = gt.get(e["qid"], {})
        our_coord = coords.get(key)
        dist_km = None
        if our_coord and our_coord[0] is not None and g.get("coord"):
            la1, lo1 = our_coord
            la2, lo2 = g["coord"]
            dist_km = round(math.hypot((la1 - la2) * 111,
                                       (lo1 - lo2) * 111 * math.cos(math.radians(la1))), 1)
        records.append({
            "key": key,
            "ours": {
                "name": e.get("ancientName") or e.get("label"),
                "modernName": e.get("modernName"),
                "type": key.split(":")[0],
                "buildingType": e.get("buildingType"),
                "description": (e.get("pleiadesDescription") or e.get("description") or "")[:300],
                "startYear": e.get("startYear"),
                "coord": our_coord,
            },
            "qid": e["qid"],
            "wikidata": {
                "label": g.get("label"),
                "description": g.get("description"),
                "instanceOf": g.get("instanceOfLabels"),
                "coord": g.get("coord"),
                "inception": g.get("inception"),
                "dissolved": g.get("dissolved"),
                "missing": g.get("missing", False),
            },
            "distanceKm": dist_km,
        })

    n_chunks = (len(records) + CHUNK_SIZE - 1) // CHUNK_SIZE
    for i in range(n_chunks):
        chunk = records[i * CHUNK_SIZE:(i + 1) * CHUNK_SIZE]
        dump_atomic(chunk, outdir / f"chunk-{i:03}.json", ensure_ascii=False, indent=1)
    print(f"{len(records)} records -> {n_chunks} chunks in {outdir}")


if __name__ == "__main__":
    main()
