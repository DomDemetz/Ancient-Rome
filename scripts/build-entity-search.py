#!/usr/bin/env python3
"""Generate the unified search manifest from the canonical entity table.

First consumer migration of ENTITY-MODEL.md step 4: one search row per
real-world entity (the table has already collapsed duplicates), replacing
buildings-search.json AND the runtime indexing of settlement layer data —
which used to double-list merged entities (Hierichous the settlement and
"Jericho" the building were two results for one place).

Row format (compact — the file ships to the client, lazily):
  k  detail key for the panel (cross-reference key scheme)
  n  display name
  t  kind (settlement, building, port, ...)
  st subtype where present (villa, temple, ...)
  la/lo  coords
  s/e    attestation window (omitted when unknown)

Output: src/data/registry/entity-search.json
"""

import json
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "src" / "data"


def candidate_keys(entity):
    """All cross-reference keys this entity's sources could open with."""
    out = []
    for k in entity["sources"]:
        if not k.startswith(("place:", "dare:", "pleiades#", "dare#", "qid#")):
            out.append(k)
            # silo re-keying: building:X rows often keep their cross-ref
            # entry under pleiades:X
            if k.startswith("building:") and k.split(":", 1)[1].isdigit():
                out.append(f"pleiades:{k.split(':', 1)[1]}")
    for k in entity["sources"]:
        if k.startswith("dare:"):
            out.append(f"settlement:{k.split(':', 1)[1]}")
        elif k.startswith("place:dare-"):
            out.append(f"settlement:{k.split('place:dare-', 1)[1]}")
        elif k.startswith("place:wd-"):
            out.append(k.split("place:", 1)[1])
        elif k.startswith("place:pl-"):
            out.append(f"settlement:{k.split('place:pl-', 1)[1]}")
    return out or entity["sources"][:1]


def richness(e):
    """How much would the panel show for this cross-ref entry?"""
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


def detail_key(entity, cr):
    """The cross-reference key whose panel shows the most — a merged
    entity's sources may be spread across keys and only one is enriched."""
    cands = candidate_keys(entity)
    return max(cands, key=lambda k: (richness(cr.get(k)), -cands.index(k)))


def main():
    table = json.load(open(DATA / "entities" / "entity-table.json"))
    cr = json.load(open(DATA / "wiki" / "cross-reference.json"))
    cr = json.load(open(DATA / "wiki" / "cross-reference.json"))
    rows = []
    aliases_added = 0
    for e in table:
        if not e.get("name") or e.get("lat") is None:
            continue
        # settlements are indexed at runtime from the already-loaded places
        # layer (zero shipped bytes; post-merge, so already deduplicated) —
        # this manifest covers the aspect entities
        if e["kind"] == "settlement":
            continue
        # battles ship in their own eager manifest (battles-search.json)
        if e["kind"] == "battle":
            continue
        # vici-only rows have no cross-reference entry to open a panel
        # with (and 70k survey points would 4x the manifest) — search
        # covers knowledge-bearing entities; vici dots stay map-only
        if all(s.startswith("vici:") for s in e["sources"]):
            continue
        # placeholder names are noise in a search index
        if e["name"] in ("Untitled",) or e["name"].lower().startswith("unnamed"):
            continue
        row = {
            "k": detail_key(e, cr),
            "n": e["name"],
            "t": e["kind"],
            "la": round(e["lat"], 4),
            "lo": round(e["lng"], 4),
        }
        if e.get("subtype"):
            row["st"] = e["subtype"]
        if e.get("attestedFrom") is not None:
            row["s"] = e["attestedFrom"]
        if e.get("attestedTo") is not None:
            # Pleiades attestation reaches the modern period (2100); the
            # atlas timeline ends at 1500 — clamp for display and timeline
            row["e"] = min(e["attestedTo"], 1500)
        alt = set()
        for src_key in e["sources"]:
            xr = cr.get(src_key)
            if not xr:
                continue
            for field in ("label", "ancientName"):
                v = xr.get(field)
                if not v or v == "?" or len(v) > 60:
                    continue
                if v.lower() != e["name"].lower():
                    alt.add(v)
        if alt:
            joined = " ".join(sorted(alt))
            row["a"] = joined[:120] if len(joined) > 120 else joined
            aliases_added += 1
        rows.append(row)

    out = DATA / "registry" / "entity-search.json"
    with open(out, "w") as fh:
        json.dump(rows, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")
    from collections import Counter
    print(f"entity-search.json: {len(rows)} rows ({out.stat().st_size // 1024} KB), {aliases_added} with aliases")
    print("by kind:", Counter(r["t"] for r in rows).most_common(8))


if __name__ == "__main__":
    main()
