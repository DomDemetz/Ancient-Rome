#!/usr/bin/env python3
"""Merge tier-A duplicate pairs: a DARE settlement row and a Pleiades
building record that are the same physical structure (exact normalized
name, <=250 m apart, category-compatible — see review/duplicate-pairs.json).

The building record survives (it carries the correct type + attestation
range). Fields the DARE row has and the building lacks (modern name,
start/end years) are copied over, with provenance. The DARE row and its
cross-reference entry are then removed; the building's cross-ref entry
gains `sameAsDare: <dareId>` so the link is never lost.

Everything is logged to src/data/review/tier-a-merge-log.json.

Usage: python3 scripts/merge-tier-a-duplicates.py [--dry-run]
"""

import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "src" / "data"


def main():
    dry = "--dry-run" in sys.argv
    pairs = [p for p in json.load(open(DATA / "review" / "duplicate-pairs.json"))
             if p.get("tier") == "A-same-entity"]
    print(f"tier-A pairs: {len(pairs)}")

    dare = json.load(open(DATA / "dare" / "settlements.json"))
    dare_by_id = {str(x["id"]): x for x in dare}
    buildings = json.load(open(DATA / "buildings" / "buildings.json"))
    b_by_id = {str(x["id"]): x for x in buildings}
    cr = json.load(open(DATA / "wiki" / "cross-reference.json"))
    places = json.load(open(DATA / "places" / "places.json"))

    log, remove_dare_ids = [], set()
    skipped = 0
    for p in pairs:
        b_id = p["building"].split(":", 1)[1]
        s_id = p["settlement"].split(":", 1)[1]
        b, s = b_by_id.get(b_id), dare_by_id.get(s_id)
        if b is None or s is None:
            skipped += 1
            continue
        copied = {}
        # modern name from DARE if building has none
        b_cr = cr.get(p["building"])
        s_cr = cr.get(p["settlement"]) or {}
        if b_cr is not None:
            if not b_cr.get("modernName") and (s.get("modern") or s_cr.get("modernName")):
                b_cr["modernName"] = s.get("modern") or s_cr["modernName"]
                copied["modernName"] = b_cr["modernName"]
            b_cr["sameAsDare"] = s_id
        # attestation years: building may be unattested where DARE has a range
        if b.get("attestedFrom") is None and s.get("startYear") not in (None, 0):
            b["attestedFrom"] = b["constructionYear"] = s["startYear"]
            copied["attestedFrom"] = s["startYear"]
        if b.get("attestedTo") is None and s.get("endYear") not in (None, 0):
            b["attestedTo"] = s["endYear"]
            copied["attestedTo"] = s["endYear"]

        remove_dare_ids.add(s_id)
        cr.pop(p["settlement"], None)
        log.append({"building": p["building"], "removedSettlement": p["settlement"],
                    "name": p["name"], "distanceKm": p["dist_km"], "copied": copied})

    dare2 = [x for x in dare if str(x["id"]) not in remove_dare_ids]
    # places.json rows reference dare ids via .dare.id
    places2 = [x for x in places
               if str((x.get("dare") or {}).get("id")) not in remove_dare_ids]

    print(f"merged: {len(log)}, skipped (already gone): {skipped}")
    print(f"dare/settlements.json: {len(dare)} -> {len(dare2)}")
    print(f"places/places.json: {len(places)} -> {len(places2)}")

    if dry:
        print("DRY RUN — nothing written")
        return

    json.dump(dare2, open(DATA / "dare" / "settlements.json", "w"),
              ensure_ascii=False, separators=(",", ":"))
    json.dump(places2, open(DATA / "places" / "places.json", "w"),
              ensure_ascii=False, separators=(",", ":"))
    json.dump(buildings, open(DATA / "buildings" / "buildings.json", "w"),
              ensure_ascii=False, indent=1)
    json.dump(cr, open(DATA / "wiki" / "cross-reference.json", "w"),
              ensure_ascii=False, indent=1)
    # append to any existing log — re-runs must not erase merge history
    log_path = DATA / "review" / "tier-a-merge-log.json"
    if log_path.exists():
        prev = json.load(open(log_path))
        seen = {e["removedSettlement"] for e in prev}
        log = prev + [e for e in log if e["removedSettlement"] not in seen]
    json.dump(log, open(log_path, "w"), ensure_ascii=False, indent=1)
    print("written; merge log -> review/tier-a-merge-log.json")


if __name__ == "__main__":
    main()
