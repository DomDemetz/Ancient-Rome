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
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic


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
            # rows carrying a Pleiades id in their key are the same Pleiades
            # place as any buildings.json row with that id — share the anchor
            m = re.search(r"pleiades[:-](\d+)$", key)
            if m:
                uf.union(key, f"pleiades#{m.group(1)}")
            if x.get("qid"):
                qid_claims[x["qid"]].append((key, norm_name(x.get("name")), x.get("type", f.stem)))

    # vici sites (the chunks already exclude the 3,606 node-merged
    # settlement points); crosswalk-vici carries vici's own dare/pleiades/
    # wikidata identity references, so dare/pid union unconditionally
    vici_cw = json.load(open(DATA / "registry" / "crosswalk-vici.json"))
    vici_index = json.load(open(DATA / "vici" / "chunks.json"))
    for info in vici_index.values():
        for x in json.load(open(DATA / "vici" / info["file"])):
            key = f"vici:{x['id']}"
            if key in sources:
                continue
            kind = x.get("siteType") or "other"
            cw = vici_cw.get(x["id"]) or {}
            if cw.get("qid"):
                x = {**x, "qid": cw["qid"]}
            sources[key] = {"kind": kind, "rec": x}
            if cw.get("dare"):
                uf.union(key, f"dare#{cw['dare']}")
            if cw.get("pid"):
                uf.union(key, f"pleiades#{cw['pid']}")
            if cw.get("qid"):
                qid_claims[cw["qid"]].append((key, norm_name(x.get("name")), kind))

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

    # --- vici identity joins by name+proximity ---
    # crosswalk-vici covers ~10k points; famous monuments it missed still
    # duplicate their canonical entity, often under another name (vici
    # "Colosseum Roma" vs "Flavian Amphitheater" whose cross-ref label is
    # "Colosseum"). Join a vici point to a non-vici record within 300 m
    # whose normalized name or cross-ref alias matches exactly, or whose
    # tokens contain the alias's tokens (city-suffixed vici names); generic
    # names carry no identity, so frequent names need 100 m.
    def cr_alias_keys(key):
        yield key
        if key.startswith("building:") and key.split(":", 1)[1].isdigit():
            yield f"pleiades:{key.split(':', 1)[1]}"
        if key.startswith("dare:"):
            yield f"settlement:{key[5:]}"
        if key.startswith("place:dare-"):
            yield f"settlement:{key[len('place:dare-'):]}"
        if key.startswith("place:pl-"):
            yield f"settlement:{key[len('place:pl-'):]}"
        if key.startswith("place:wd-"):
            yield key[len('place:'):]

    name_freq = Counter()
    alias_sets = {}
    for key, s in sources.items():
        raw = s["rec"].get("name") or ""
        aliases = {norm_name(raw)}
        if key.startswith("vici:"):
            # vici alias forms: "Ugarit [Ugaryt]", "Qatna - Tell el-Meszrife"
            aliases.add(norm_name(re.sub(r"\[.*?\]", "", raw)))
            aliases.add(norm_name(raw.split(" - ")[0]))
        else:
            for ck in cr_alias_keys(key):
                e = cr.get(ck)
                if e:
                    aliases.add(norm_name(e.get("label")))
                    aliases.add(norm_name(e.get("ancientName")))
        aliases.discard("")
        aliases = {a for a in aliases if not a.startswith(("unnamed", "untitled"))}
        alias_sets[key] = aliases
        name_freq.update(aliases)

    grid = defaultdict(list)
    for key, s in sources.items():
        if key.startswith("vici:"):
            continue
        r = s["rec"]
        if r.get("lat") is None:
            continue
        grid[(round(r["lat"] * 100), round(r["lng"] * 100))].append(key)

    import math
    vici_name_joins = 0
    for key, s in sources.items():
        if not key.startswith("vici:") or not alias_sets[key]:
            continue
        r = s["rec"]
        la, lo = r.get("lat"), r.get("lng")
        if la is None:
            continue
        cx, cy = round(la * 100), round(lo * 100)
        vtokens = [(a, set(a.split())) for a in alias_sets[key]]
        best = None
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for okey in grid[(cx + dx, cy + dy)]:
                    orc = sources[okey]["rec"]
                    km = math.hypot((orc["lat"] - la) * 111,
                                    (orc["lng"] - lo) * 111 * math.cos(math.radians(la)))
                    if km > 0.3:
                        continue
                    for oa in alias_sets[okey]:
                        exact = oa in alias_sets[key]
                        # a vici "Sirmium, Imperial Basilica" is a structure
                        # AT Sirmium, not the city — containment never joins
                        # into a settlement record
                        contains = (not exact and
                                    sources[okey]["kind"] != "settlement" and
                                    any(set(oa.split()) <= vt and oa != a
                                        for a, vt in vtokens))
                        if not (exact or contains):
                            continue
                        limit = 0.1 if (name_freq[oa] > 25 or contains) else 0.3
                        if km <= limit and (best is None or km < best[0]):
                            best = (km, okey)
        if best:
            uf.union(best[1], key)
            vici_name_joins += 1
    print(f"vici name+proximity joins: {vici_name_joins}")

    # --- adjudicated structure-identity joins (attach-nodes-to-unified) ---
    # rel=same means the place node IS the unified entity (villa node ↔
    # villa record, verified type+name+distance); union unconditionally.
    for k, v in json.load(open(DATA / "registry" / "unified-nodes.json")).items():
        if v.get("rel") != "same" or k not in sources:
            continue
        node_key = f"place:{v['node']}"
        if node_key in sources:
            uf.union(node_key, k)

    # --- adjudicated same-QID merge links (resolve-same-qid-groups.py) ---
    # These groups were judged same-entity per the QID's own instanceOf
    # classes; union unconditionally, bypassing the name/kind guards below.
    links_path = DATA / "entities" / "same-qid-links.json"
    if links_path.exists():
        for link in json.load(open(links_path)):
            linked = [k for k in link["keys"] if k in sources]
            for other in linked[1:]:
                uf.union(linked[0], other)

    # --- adjudicated cross-silo duplicate verdicts (2026-07-10 swarm) ---
    # review/cross-silo-dupes-plan.json: judged same/distinct under a
    # written rubric. Only high-confidence 'same' pairs union; the plan is
    # partial and grows as batches complete — consumption is idempotent.
    plan_path = DATA / "review" / "cross-silo-dupes-plan.json"
    plan_unions = 0
    if plan_path.exists():
        for v in json.load(open(plan_path))["verdicts"]:
            if v.get("verdict") != "same" or v.get("confidence") != "high":
                continue
            if v["a"] in sources and v["b"] in sources:
                uf.union(v["a"], v["b"])
                plan_unions += 1
        print(f"adjudicated same-pair unions: {plan_unions}")

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
            # placeholder names carry no identity evidence, and vici survey
            # points sharing a complex's QID (watchtower chains, quarry
            # features) are distinct real-world dots — vici merges via QID
            # only against the other silos
            if not name or name.startswith(("unnamed", "untitled")):
                continue
            keys.sort(key=lambda k: k.startswith("vici:"))
            anchor_lat, anchor_lng = coord_of(keys[0])
            for other in keys[1:]:
                if keys[0].startswith("vici:") and other.startswith("vici:"):
                    continue
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
        # a rel=same merge means the "settlement" node was really this
        # structure all along (DARE typed it villa/temple; places ingest
        # flattened everything to settlement) — the specific kind wins
        kinds = [sources[k]["kind"] for k in keys]
        kind = (next((kk for kk in kinds if kk not in ("settlement", "other")), None)
                or next((kk for kk in kinds if kk != "other"), kinds[0]))
        ent = {
            "id": keys[0],
            "kind": kind,
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
        # attestation window: widest across sources — but vici stamps
        # period-placeholder years (-600 etc.); they only count when no
        # other source dates the entity (Circus Maximus s=-550 must not
        # widen onto the -600 sentinel and lose its monument label)
        date_keys = [k for k in keys if not k.startswith("vici:")] or keys
        starts = [sources[k]["rec"].get("startYear") or
                  sources[k]["rec"].get("attestedFrom") for k in date_keys]
        ends = [sources[k]["rec"].get("endYear") or
                sources[k]["rec"].get("attestedTo") for k in date_keys]
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
    dump_atomic(entities, outdir / "entity-table.json", ensure_ascii=False, separators=(",", ":"))

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
