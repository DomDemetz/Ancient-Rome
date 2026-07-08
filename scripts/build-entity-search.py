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


def detail_key(entity):
    """Map an entity to the cross-reference key its detail panel opens with."""
    for k in entity["sources"]:
        # unified aspect ids are already cross-reference keys
        if not k.startswith(("place:", "dare:", "pleiades#", "dare#", "qid#")):
            return k
    for k in entity["sources"]:
        if k.startswith("dare:"):
            return f"settlement:{k.split(':', 1)[1]}"
        if k.startswith("place:dare-"):
            return f"settlement:{k.split('place:dare-', 1)[1]}"
        if k.startswith("place:wd-"):
            return k.split("place:", 1)[1]
        if k.startswith("place:pl-"):
            return f"settlement:{k.split('place:pl-', 1)[1]}"
    return entity["sources"][0]


def main():
    table = json.load(open(DATA / "entities" / "entity-table.json"))
    rows = []
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
        # placeholder names are noise in a search index
        if e["name"] in ("Untitled",) or e["name"].lower().startswith("unnamed"):
            continue
        row = {
            "k": detail_key(e),
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
        rows.append(row)

    out = DATA / "registry" / "entity-search.json"
    with open(out, "w") as fh:
        json.dump(rows, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")
    from collections import Counter
    print(f"entity-search.json: {len(rows)} rows ({out.stat().st_size // 1024} KB)")
    print("by kind:", Counter(r["t"] for r in rows).most_common(8))


if __name__ == "__main__":
    main()
