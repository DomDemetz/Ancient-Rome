#!/usr/bin/env python3
"""Build the canonical entity table (ENTITY-MODEL.md step: unify).

One row per real-world entity, unioned from every silo, with:
  - stable id (the strongest source key, precedence: pleiades > dare > qid > source id)
  - all source keys that describe the same entity (sameAs resolution via
    sameAsDare links, shared QIDs verified by the 2026-07-08 swarm, and
    the places crosswalk)
  - per-field provenance (which source supplied name/coords/dates)
  - containedInQid geographic anchors where identity was rejected

Output: src/data/entities/entity-table.json + a stats report to stdout.
This is a BUILD ARTIFACT — regenerate with this script; do not hand-edit.
The per-layer files remain the shipped format; they become derived views
of this table as consumers migrate (see docs/ENTITY-MODEL.md).
"""

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "src" / "data"


def norm_name(s):
    s = (s or "").lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


class UnionFind:
    def __init__(self):
        self.parent = {}

    def find(self, x):
        self.parent.setdefault(x, x)
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


def main():
    uf = UnionFind()
    sources = {}  # source key -> raw record + kind
    # QID alone is weak identity evidence: DARE backfill stamped parent-fort
    # QIDs onto whole watchtower chains (Brigetio - 1..58). Records sharing a
    # QID merge only when their normalized names also agree exactly.
    qid_claims = defaultdict(list)  # qid -> [(source key, normalized name, kind)]

    # --- ingest silos ---
    for x in json.load(open(DATA / "places" / "places.json")):
        key = f"place:{x['id']}"
        sources[key] = {"kind": "settlement", "rec": x}
        if x.get("pid"):
            uf.union(key, f"pleiades#{x['pid']}")
        if x.get("qid"):
            qid_claims[x["qid"]].append((key, norm_name(x.get("name")), "settlement"))
        if (x.get("dare") or {}).get("id"):
            uf.union(key, f"dare#{x['dare']['id']}")

    for x in json.load(open(DATA / "dare" / "settlements.json")):
        key = f"dare:{x['id']}"
        sources[key] = {"kind": "settlement", "rec": x}
        uf.union(key, f"dare#{x['id']}")

    for x in json.load(open(DATA / "buildings" / "buildings.json")):
        key = f"building:{x['id']}"
        sources[key] = {"kind": "building", "rec": x}
        uf.union(key, f"pleiades#{x['id']}")
        if x.get("qid"):
            qid_claims[x["qid"]].append((key, norm_name(x.get("name")), "building"))

    for f in sorted((DATA / "unified").glob("*.json")):
        for x in json.load(open(f)):
            key = x["id"] if ":" in str(x["id"]) else f"{f.stem}:{x['id']}"
            if key in sources:
                continue
            sources[key] = {"kind": x.get("type", f.stem), "rec": x}
            if x.get("qid"):
                qid_claims[x["qid"]].append((key, norm_name(x.get("name")), x.get("type", f.stem)))

    # --- cross-reference: sameAsDare links + containedInQid + verified qids ---
    cr = json.load(open(DATA / "wiki" / "cross-reference.json"))
    contained = {}
    for k, e in cr.items():
        if e.get("sameAsDare"):
            # building:<pid> is same entity as dare row
            uf.union(k.replace("building:", "pleiades#").replace(":", "#")
                     if k.startswith("building:") else k,
                     f"dare#{e['sameAsDare']}")
            if k.startswith("building:"):
                uf.union(f"pleiades#{k.split(':')[1]}", f"dare#{e['sameAsDare']}")
        if e.get("containedInQid"):
            contained[k] = e["containedInQid"]
        if e.get("qid") and k in sources:
            qid_claims[e["qid"]].append(
                (k, norm_name(e.get("ancientName") or e.get("label")),
                 sources[k]["kind"]))

    # --- name+kind+proximity-guarded QID unions ---
    # An aqueduct named after its city carries the city's name AND QID; it is
    # still a different entity — kinds must agree. And "Ad Pontem" names three
    # different places that QID-backfill collapsed onto one Wikidata item —
    # records must also sit within 30 km to merge.
    def coord_of(key):
        r = sources[key]["rec"]
        return (r.get("lat"), r.get("lng"))

    for qid, claims in qid_claims.items():
        by_name_kind = defaultdict(list)
        for key, name, kind in claims:
            by_name_kind[(name, kind)].append(key)
        for (name, kind), keys in by_name_kind.items():
            if not name:
                continue
            anchor_lat, anchor_lng = coord_of(keys[0])
            for other in keys[1:]:
                la, lo = coord_of(other)
                if (anchor_lat is None or la is None or
                        (abs(la - anchor_lat) < 0.3 and abs(lo - anchor_lng) < 0.4)):
                    uf.union(keys[0], other)

    # --- group records into entities ---
    groups = defaultdict(list)
    for key in sources:
        groups[uf.find(key)].append(key)

    def source_rank(k):
        return (0 if k.startswith("building:") else
                1 if k.startswith("place:") else
                2 if k.startswith("dare:") else 3)

    entities = []
    for root, keys in groups.items():
        keys.sort(key=source_rank)
        primary = sources[keys[0]]
        rec = primary["rec"]
        name = None
        name_src = None
        coords = None
        coords_src = None
        qid = None
        for k in keys:
            r = sources[k]["rec"]
            if name is None and (r.get("name") or "").strip():
                name, name_src = r["name"], k
            if coords is None and r.get("lat") is not None:
                coords, coords_src = [r["lat"], r["lng"]], k
            qid = qid or r.get("qid")
        ent = {
            "id": keys[0],
            "kind": primary["kind"],
            "name": name,
            "lat": coords[0] if coords else None,
            "lng": coords[1] if coords else None,
            "qid": qid,
            "sources": keys,
            "provenance": {"name": name_src, "coords": coords_src},
        }
        # subtype for buildings/unified
        st = rec.get("buildingType") or rec.get("subtype")
        if st:
            ent["subtype"] = st
        # attestation window: widest across sources
        starts = [s["rec"].get("startYear") or s["rec"].get("attestedFrom")
                  for s in (sources[k] for k in keys)]
        ends = [s["rec"].get("endYear") or s["rec"].get("attestedTo")
                for s in (sources[k] for k in keys)]
        starts = [y for y in starts if y not in (None, 0)]
        ends = [y for y in ends if y not in (None, 0)]
        if starts:
            ent["attestedFrom"] = min(starts)
        if ends:
            ent["attestedTo"] = max(ends)
        # geographic anchor from rejected-identity QIDs
        for k in keys:
            crk = k.replace("place:dare-", "settlement:").replace("dare:", "settlement:")
            if crk in contained:
                ent["containedInQid"] = contained[crk]
                break
        entities.append(ent)

    entities.sort(key=lambda e: e["id"])
    outdir = DATA / "entities"
    outdir.mkdir(exist_ok=True)
    json.dump(entities, open(outdir / "entity-table.json", "w"),
              ensure_ascii=False, separators=(",", ":"))

    multi = [e for e in entities if len(e["sources"]) > 1]
    print(f"entity table: {len(entities)} entities from {len(sources)} source records")
    print(f"multi-source entities (dupes collapsed): {len(multi)}")
    print("by kind:", Counter(e["kind"] for e in entities).most_common(12))
    print("largest merges:")
    for e in sorted(entities, key=lambda e: -len(e["sources"]))[:5]:
        print(f"  {e['name']}: {len(e['sources'])} sources {e['sources'][:6]}")
    missing_name = sum(1 for e in entities if not e["name"])
    missing_coords = sum(1 for e in entities if e["lat"] is None)
    print(f"missing name: {missing_name}, missing coords: {missing_coords}")


if __name__ == "__main__":
    main()
