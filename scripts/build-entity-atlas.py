#!/usr/bin/env python3
"""Emit the runtime entity atlas from the canonical entity table.

THE unified rework artifact (workbench 2026-07-10): one file family that a
single renderer draws, replacing the three point silos (ViciLayer,
UnifiedLayer datasets, legacy Amphitheater/Buildings layers). Battles,
epigraphy, and settlements stay with their special layers — a row whose
sources include a place node (place:/dare:) is ALREADY drawn by
PlacesLayer, so it is excluded here; that split is what makes "one dot
per real-world entity" true by construction.

Output: src/data/entities/atlas/<category>.json + chunks.json index.
Row format (compact, ships to the client per-category):
  i   entity id (knowledge-features lookup key; the table's row id)
  d   detail key for the cross-ref panel, when it differs from i
  n   name (omitted when unnamed)
  k   kind (fort, temple, villa, shipwreck, ...)
  st  subtype where present (circus, amphora cargo, gold, ...)
  la/lo  coords
  s/e attestation window (omitted when unknown)
  t   tier: 1 knowledge-bearing, 2 named, 3 unnamed survey texture
"""

import json
from collections import Counter, defaultdict
from pathlib import Path
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic

DATA = Path(__file__).resolve().parent.parent / "src" / "data"

# kind -> the settlement legend's 7 categories (settlementStyles.ts).
# 'other' (unclassified vici survey points) keeps its own chunk so the
# renderer can gate it to deep zoom; it is not a panel category.
CATEGORY = {
    "settlement": "cities", "townhouse": "cities", "building": "cities",
    "amphitheater": "cities", "theater": "cities", "oppidum": "cities",
    "villa": "rural", "estate": "rural", "farm": "rural",
    "fort": "military",
    "road": "infrastructure", "bridge": "infrastructure",
    "aqueduct": "infrastructure", "bath": "infrastructure",
    "port": "infrastructure",
    "temple": "religious", "sanctuary": "religious", "shrine": "religious",
    "religious-site": "religious", "church": "religious",
    "monastery": "religious",
    "mine": "production", "press": "production", "shipwreck": "production",
    "cemetery": "funerary", "tomb": "funerary", "tumulus": "funerary",
    "pyramid": "funerary", "mausoleum": "funerary",
}

# ── panel richness scoring, shared shape with build-entity-search ──────────
def richness(e):
    if e is None:
        return -1
    score = 0
    if e.get("extract") or e.get("wikiUrl"):
        score += 4
    if e.get("wdProps"):
        score += 2
    if e.get("ancientName") or e.get("label"):
        score += 1
    if e.get("imageUrl"):
        score += 1
    return score


def candidate_keys(entity):
    out = []
    for k in entity["sources"]:
        if not k.startswith(("place:", "dare:", "pleiades#", "dare#", "qid#",
                             "vici:")):
            out.append(k)
            if k.startswith("building:") and k.split(":", 1)[1].isdigit():
                out.append(f"pleiades:{k.split(':', 1)[1]}")
    return out or entity["sources"][:1]


def main():
    table = json.load(open(DATA / "entities" / "entity-table.json"))
    cr = json.load(open(DATA / "wiki" / "cross-reference.json"))
    knowledge = json.load(open(DATA / "knowledge" / "features.json"))

    by_cat = defaultdict(list)
    skipped = Counter()
    for e in table:
        if e["kind"] == "battle":
            skipped["battle (BattleLayer)"] += 1
            continue
        if e["lat"] is None:
            skipped["no coords"] += 1
            continue
        if any(s.startswith(("place:", "dare:")) for s in e["sources"]):
            skipped["place node (PlacesLayer)"] += 1
            continue
        cat = CATEGORY.get(e["kind"], "other")
        row = {"i": e["id"], "la": round(e["lat"], 4), "lo": round(e["lng"], 4),
               "k": e["kind"]}
        if e.get("subtype") and e["subtype"] != e["kind"]:
            row["st"] = e["subtype"]
        name = (e.get("name") or "").strip()
        unnamed = (not name or name.lower().startswith(("unnamed", "untitled")))
        if not unnamed:
            row["n"] = name
        if e.get("attestedFrom") is not None:
            row["s"] = e["attestedFrom"]
        if e.get("attestedTo") is not None:
            row["e"] = min(e["attestedTo"], 1500)
        cands = candidate_keys(e)
        detail = max(cands, key=lambda k: (richness(cr.get(k)), -cands.index(k)))
        has_knowledge = bool(
            (knowledge.get(e["id"]) or {}).get("extract")
            or any((knowledge.get(k) or {}).get("extract") for k in cands)
            or richness(cr.get(detail)) >= 4)
        if detail != e["id"] and richness(cr.get(detail)) > 0:
            row["d"] = detail
        row["t"] = 1 if has_knowledge else (2 if not unnamed else 3)
        by_cat[cat].append(row)

    outdir = DATA / "entities" / "atlas"
    outdir.mkdir(exist_ok=True)
    index = {}
    for cat, rows in sorted(by_cat.items()):
        rows.sort(key=lambda r: (r["t"], r["i"]))
        p = outdir / f"{cat}.json"
        dump_atomic(rows, p, ensure_ascii=False, separators=(",", ":"))
        tiers = Counter(r["t"] for r in rows)
        index[cat] = {"file": f"{cat}.json", "count": len(rows),
                      "tiers": {str(t): tiers[t] for t in sorted(tiers)},
                      "kb": p.stat().st_size // 1024}
        print(f"  atlas/{cat + '.json':22} {len(rows):6} rows  "
              f"t1={tiers[1]:5} t2={tiers[2]:6} t3={tiers[3]:6}  "
              f"{p.stat().st_size // 1024:5} KB")
    dump_atomic(index, outdir / "chunks.json", ensure_ascii=False, indent=1)

    total = sum(v["count"] for v in index.values())
    print(f"entity atlas: {total} rows in {len(index)} category chunks")
    print("skipped:", dict(skipped))


if __name__ == "__main__":
    main()
