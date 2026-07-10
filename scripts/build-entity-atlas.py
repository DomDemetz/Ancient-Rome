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

# THE taxonomy — one controlled kind list, category derived, all source
# vocabularies mapped (src/data/taxonomy.json, designed 2026-07-11).
TAX = json.load(open(Path(__file__).resolve().parent.parent / "src" / "data" / "taxonomy.json"))
KINDS = TAX["kinds"]
SYN = TAX["synonyms"]
SRC_DARE = {int(k): v for k, v in TAX["sources"]["dare"].items()}
SRC_VICI = TAX["sources"]["vici"]
SRC_BUILDING = TAX["sources"]["buildingSubtype"]
SRC_PORT = TAX["sources"]["portSubtype"]
SETTLEMENT_DARE_TYPES = {t for t, k in SRC_DARE.items() if k == "settlement"}


def resolve_kind(raw):
    """canonical kind or None (None = not in the atlas)."""
    if raw is None:
        return None
    k = SYN.get(raw, raw)
    return k if k in KINDS else None


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


def node_id_of(source_key):
    if source_key.startswith("place:"):
        return source_key[len("place:"):]
    if source_key.startswith("dare:"):
        return f"dare-{source_key[len('dare:'):]}"
    return None


# provenance: source-key prefix -> one-letter code (popup expands to labels;
# a string of codes costs ~4 bytes/row vs ~25 for labels x 92k rows)
def source_codes(sources):
    codes = set()
    for k in sources:
        if k.startswith("vici:"):
            codes.add("v")
        elif k.startswith(("pleiades:", "building:", "place:pl-")):
            codes.add("p")
        elif k.startswith(("dare:", "place:dare-")):
            codes.add("d")
        elif k.startswith(("wd-", "place:wd-")) or ":wd-" in k:
            codes.add("w")
        elif k.startswith("port:"):
            codes.add("a")
        elif k.startswith("shipwreck:"):
            codes.add("o")
        elif k.startswith("mine:"):
            codes.add("m")
        elif k.startswith("amphitheater:"):
            codes.add("r")
        else:
            codes.add("u")
    return "".join(sorted(codes))


MINED_PATH = DATA / "registry" / "vici-other-kinds.json"
MINED_KINDS = json.load(open(MINED_PATH)) if MINED_PATH.exists() else {}
# research-swarm verdicts for generic 'building' rows (2026-07-11:
# per-entity evidence + web research, high-confidence only)
BLDG_PATH = DATA / "registry" / "building-kinds.json"
BLDG_KINDS = json.load(open(BLDG_PATH)) if BLDG_PATH.exists() else {}


def main():
    table = json.load(open(DATA / "entities" / "entity-table.json"))
    cr = json.load(open(DATA / "wiki" / "cross-reference.json"))
    knowledge = json.load(open(DATA / "knowledge" / "features.json"))
    place_knowledge = json.load(open(DATA / "knowledge" / "places.json"))
    dare_type = {p["id"]: (p.get("dare") or {}).get("type")
                 for p in json.load(open(DATA / "places" / "places.json"))}

    by_cat = defaultdict(list)
    skipped = Counter()
    for e in table:
        if e["kind"] == "battle":
            skipped["battle (BattleLayer)"] += 1
            continue
        # unified aqueduct points belong to AqueductLayer (points + line
        # geometry, one curated experience) — same ownership rule as battles;
        # DARE aqueduct NODES have no unified source and stay in the atlas
        if any(s.startswith("aqueduct:") for s in e["sources"]):
            skipped["aqueduct (AqueductLayer)"] += 1
            continue
        if e["lat"] is None:
            skipped["no coords"] += 1
            continue
        node_ids = [n for n in (node_id_of(s) for s in e["sources"]) if n]
        struct_row = None
        if node_ids:
            types = [dare_type.get(n) for n in node_ids if n in dare_type]
            # a settlement node (or an untyped population/gazetteer node)
            # keeps the row with PlacesLayer; a row whose nodes are ALL
            # structures renders through the atlas instead
            if any(t is None or t in SETTLEMENT_DARE_TYPES for t in types) or not types:
                skipped["settlement node (PlacesLayer)"] += 1
                continue
            struct_row = resolve_kind(SRC_DARE.get(types[0]))
            if struct_row is None:
                skipped["dropped: unmapped dare type"] += 1
                continue
        # ── ONE kind resolution (the taxonomy is the only vocabulary) ──
        kind = resolve_kind(e["kind"])
        if e["kind"] == "building":
            kind = (resolve_kind(BLDG_KINDS.get(e["id"]))
                    or resolve_kind(SRC_BUILDING.get(e.get("subtype")))
                    or "building")
        elif e["kind"] == "port":
            kind = resolve_kind(SRC_PORT.get(e.get("subtype"))) or "port"
        elif e["kind"] == "other":
            # vici survey points with no source type: adjudicated kinds from
            # the mining swarm (registry/vici-other-kinds.json); else dropped
            kind = None
            for src in e["sources"]:
                if src.startswith("vici:"):
                    kind = resolve_kind(MINED_KINDS.get(src[len("vici:"):]))
                    if kind:
                        break
        if kind == "building" and e["id"] in BLDG_KINDS:
            kind = resolve_kind(BLDG_KINDS[e["id"]]) or kind
        if struct_row and (kind is None or kind == "settlement"):
            kind = struct_row
        if kind is None:
            skipped["dropped: no canonical kind"] += 1
            continue
        if kind == "settlement" and not node_ids:
            # vici-only settlements: real settlements, no place node — they
            # ship in the atlas settlement chunk (drawn with the
            # Settlements toggle, not a Sites category)
            pass
        cat = kind  # one chunk per kind — the toggles ARE the things (Dominik 2026-07-11)
        row = {"i": e["id"], "la": round(e["lat"], 4), "lo": round(e["lng"], 4),
               "k": kind, "p": source_codes(e["sources"])}
        if e.get("subtype") and e["subtype"] != kind and e["kind"] != "building":
            row["st"] = e["subtype"]
        name = (e.get("name") or "").strip()
        unnamed = (not name or name.lower().startswith(("unnamed", "untitled")))
        if not unnamed:
            row["n"] = name
        if e.get("attestedFrom") is not None:
            row["s"] = e["attestedFrom"]
        if e.get("attestedTo") is not None:
            row["e"] = min(e["attestedTo"], 1500)
        if struct_row:
            # structural place nodes resolve knowledge through the places
            # store (knowledge/places.json is keyed by node id) — d carries
            # the node id; AtlasLayer routes dare-/pl-/wd- keys there
            node = next((n for n in node_ids if n in dare_type), node_ids[0])
            has_knowledge = bool((place_knowledge.get(node) or {}).get("extract"))
            if node != e["id"]:
                row["d"] = node
        else:
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
    print(f"entity atlas: {total} rows in {len(index)} kind chunks")
    print("skipped:", dict(skipped))


if __name__ == "__main__":
    main()
