#!/usr/bin/env python3
"""Reclassify the Pleiades 'buildings' dataset from real featureType tokens.

The original ingest (ingest-pleiades-buildings.ts) matched building keywords
as *substrings* of Pleiades placeTypes, so 'archaeological-site', 'archipelago'
and 'archive-repository' all became buildingType 'arch', and 'villa' became
'palace'. It also fabricated constructionYear from period-bucket midpoints
with a fallback of 50 AD (75% of records).

This script rebuilds classification and dates from the Pleiades places CSV
(exact featureTypes tokens + real attested minDate/maxDate):

  - records whose featureTypes include 'settlement' -> dropped (they are
    settlements, not buildings; most already exist in the settlement layers)
  - records with no exact building-type token -> dropped (findspots, islands,
    cemeteries, forts, walls, ...)
  - records with no attested overlap of [-1000, 1500] -> dropped (Neolithic
    monuments, post-medieval complexes)
  - kept records get: corrected buildingType (villa is its own type now),
    constructionYear = first attested year (or null if unattested),
    attestedFrom/attestedTo = real attestation range

Propagates to: buildings/buildings.json, wiki/cross-reference.json,
unified/building.json, registry/buildings-search.json, wiki/buildings-wiki.json.
Dropped records are written to src/data/review/dropped-building-sites.json.
"""

import csv
import gzip
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "src" / "data"
CSV_GZ = DATA / "downloads" / "pleiades-places-latest.csv.gz"

# Exact featureType token -> our buildingType. First match in this order wins.
TOKEN_TYPE = [
    ("amphitheatre", "amphitheater"),
    ("theatre", "theater"),
    ("odeon", "theater"),
    ("temple", "temple"),
    ("temple-2", "temple"),
    ("sanctuary", "temple"),
    ("shrine", "temple"),
    ("nymphaeum", "temple"),
    ("church", "basilica"),
    ("church-2", "basilica"),
    ("basilica", "basilica"),
    ("monastery", "basilica"),
    ("bath", "bath"),
    ("forum", "forum"),
    ("agora", "forum"),
    ("plaza", "forum"),
    ("stoa", "forum"),
    ("circus", "circus"),
    ("hippodrome", "circus"),
    ("stadium", "circus"),
    ("arch", "arch"),
    ("monument", "monument"),
    ("mausoleum", "monument"),
    ("tomb", "monument"),
    ("villa", "villa"),
    ("palace", "palace"),
    ("palace-complex", "palace"),
    ("library", "library"),
    ("bridge", "bridge"),
    ("aqueduct", "aqueduct"),
]
DROP_IF_PRESENT = {"settlement", "settlement-modern"}
WINDOW = (-1000, 1500)


def parse_year(s):
    s = (s or "").strip()
    if not s:
        return None
    try:
        return int(float(s))
    except ValueError:
        return None


def classify(tokens):
    toks = {t.strip() for t in tokens.split(",") if t.strip()}
    if toks & DROP_IF_PRESENT:
        return None, "settlement-record"
    for token, btype in TOKEN_TYPE:
        if token in toks:
            return btype, None
    return None, "no-building-token"


def main():
    pleiades = {}
    with gzip.open(CSV_GZ, "rt") as fh:
        for row in csv.DictReader(fh):
            pleiades[row["id"]] = row

    buildings = json.load(open(DATA / "buildings" / "buildings.json"))
    kept, dropped = [], []

    for b in buildings:
        row = pleiades.get(str(b["id"]))
        if row is None:
            dropped.append({**b, "dropReason": "not-in-pleiades-dump"})
            continue
        btype, why = classify(row["featureTypes"])
        lo, hi = parse_year(row["minDate"]), parse_year(row["maxDate"])
        if btype is None:
            dropped.append({**b, "dropReason": why,
                            "featureTypes": row["featureTypes"]})
            continue
        if lo is not None and hi is not None and (hi < WINDOW[0] or lo > WINDOW[1]):
            dropped.append({**b, "dropReason": "outside-time-window",
                            "attestedFrom": lo, "attestedTo": hi})
            continue
        nb = dict(b)
        nb["buildingType"] = btype
        nb["constructionYear"] = lo  # first attested year; None if unattested
        nb["attestedFrom"] = lo
        nb["attestedTo"] = hi
        kept.append(nb)

    json.dump(kept, open(DATA / "buildings" / "buildings.json", "w"),
              ensure_ascii=False, indent=1)
    review = DATA / "review"
    review.mkdir(exist_ok=True)
    json.dump(dropped, open(review / "dropped-building-sites.json", "w"),
              ensure_ascii=False, indent=1)

    kept_ids = {str(b["id"]) for b in kept}
    kept_by_id = {str(b["id"]): b for b in kept}
    dropped_ids = {str(b["id"]) for b in dropped}

    # --- cross-reference.json: delete dropped, update kept ---
    cr_path = DATA / "wiki" / "cross-reference.json"
    cr = json.load(open(cr_path))
    removed_cr = 0
    for bid in dropped_ids:
        if cr.pop(f"building:{bid}", None) is not None:
            removed_cr += 1
    updated_cr = 0
    for bid in kept_ids:
        e = cr.get(f"building:{bid}")
        if e is None:
            continue
        nb = kept_by_id[bid]
        e["buildingType"] = nb["buildingType"]
        if nb["attestedFrom"] is not None:
            e["startYear"] = nb["attestedFrom"]
        else:
            e.pop("startYear", None)
        if nb["attestedTo"] is not None and nb["attestedTo"] <= WINDOW[1]:
            e["endYear"] = nb["attestedTo"]
        updated_cr += 1
    json.dump(cr, open(cr_path, "w"), ensure_ascii=False, indent=1)

    # --- unified/building.json ---
    ub_path = DATA / "unified" / "building.json"
    ub = json.load(open(ub_path))
    n_before = len(ub)
    ub2 = []
    for e in ub:
        bid = e["id"].split(":", 1)[1] if ":" in e["id"] else e["id"]
        if bid in dropped_ids:
            continue
        if bid in kept_by_id:
            nb = kept_by_id[bid]
            e["subtype"] = nb["buildingType"]
            e["startYear"] = nb["attestedFrom"] if nb["attestedFrom"] is not None else 0
            e["endYear"] = nb["attestedTo"] if nb["attestedTo"] is not None else 0
        ub2.append(e)
    json.dump(ub2, open(ub_path, "w"), ensure_ascii=False, indent=1)

    # --- registry/buildings-search.json ---
    bs_path = DATA / "registry" / "buildings-search.json"
    bs = json.load(open(bs_path))
    bs2 = [e for e in bs
           if not (e.get("t") == "building"
                   and e["id"].split(":", 1)[-1] in dropped_ids)]
    with open(bs_path, "w") as fh:
        json.dump(bs2, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")

    # --- wiki/buildings-wiki.json (keyed by bare pleiades id) ---
    bw_path = DATA / "wiki" / "buildings-wiki.json"
    bw = json.load(open(bw_path))
    bw2 = {k: v for k, v in bw.items() if k not in dropped_ids}
    json.dump(bw2, open(bw_path, "w"), ensure_ascii=False, indent=1)

    from collections import Counter
    print(f"buildings: {len(buildings)} -> kept {len(kept)}, dropped {len(dropped)}")
    print("drop reasons:", Counter(d["dropReason"] for d in dropped).most_common())
    print("new type distribution:", Counter(b["buildingType"] for b in kept).most_common())
    print(f"cross-reference: removed {removed_cr}, updated {updated_cr}")
    print(f"unified/building.json: {n_before} -> {len(ub2)}")
    print(f"buildings-search.json: {len(bs)} -> {len(bs2)}")
    print(f"buildings-wiki.json: {len(bw)} -> {len(bw2)}")


if __name__ == "__main__":
    main()
