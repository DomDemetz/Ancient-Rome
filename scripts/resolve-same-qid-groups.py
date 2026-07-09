#!/usr/bin/env python3
"""Adjudicate cross-silo records that share a verified QID.

After the identity swarm, a QID on a record means "this record IS that
entity" — so two records sharing a QID are the same entity (merge them)
UNLESS one of them wears the QID wrongly (neighbor contamination the
swarm missed: a press stamped with the amphitheater's QID).

Decision per QID group, using the QID's own instanceOf classes:
  - members whose kind is structure-compatible with the QID's classes are
    TRUE bearers; members whose kind is incompatible are contaminated ->
    emit a strip instruction.
  - two or more true bearers -> emit a merge link (consumed by
    build-entity-table.py as an unconditional union).
  - groups where no member matches, or the QID has no classes -> manual.

Outputs (plan only — nothing is modified):
  src/data/review/same-qid-plan.json

Usage: python3 scripts/resolve-same-qid-groups.py <ground-truth.json>
"""

import json
import math
import sys
from collections import defaultdict
from pathlib import Path
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic


DATA = Path(__file__).resolve().parent.parent / "src" / "data"

# Default: a shared verified QID means shared identity (bearer). A member is
# stripped only when the QID's classes are ALIEN to its kind, or demoted to
# containedInQid when the QID is a place-anchor and the record is an aspect.
ALIEN = {
    "amphitheater": ["aqueduct", "mine", "quarry", "shipwreck", "harbor", "battle", "river", "road"],
    "aqueduct": ["amphitheatre", "mine", "quarry", "shipwreck", "battle", "tomb", "tumulus"],
    "building": ["shipwreck", "battle", "river", "road", "weather", "mine", "quarry"],
    "temple": ["mine", "quarry", "shipwreck", "aqueduct", "amphitheatre", "battle"],
    "villa": ["mine", "quarry", "shipwreck", "aqueduct", "amphitheatre", "battle", "church"],
    "bridge": ["mine", "quarry", "shipwreck", "amphitheatre", "battle", "temple", "church"],
    "religion": ["mine", "quarry", "shipwreck", "aqueduct", "harbor", "battle",
                 "weather", "road", "river", "amphitheatre"],
    "religious": ["mine", "quarry", "shipwreck", "aqueduct", "battle"],
    "shipwreck": ["temple", "church", "amphitheatre", "mine", "quarry", "aqueduct",
                  "battle", "villa", "forest", "protected area"],
    "mine": ["temple", "church", "amphitheatre", "shipwreck", "aqueduct", "battle", "villa"],
    "press": ["amphitheatre", "shipwreck", "battle", "aqueduct", "temple", "church"],
    "port": ["amphitheatre", "mine", "quarry", "battle", "temple", "church", "villa"],
    "tomb": ["mine", "quarry", "shipwreck", "aqueduct", "amphitheatre", "battle"],
    "battle": ["temple", "church", "villa", "mine", "aqueduct", "amphitheatre", "shipwreck"],
    "settlement": ["shipwreck", "battle", "weather", "river"],
    "pleiades": ["shipwreck", "battle", "weather"],
}

def kind_of(key):
    return key.split(":")[0] if ":" in key else "settlement"


def km(a, b):
    return math.hypot((a[0] - b[0]) * 111,
                      (a[1] - b[1]) * 111 * math.cos(math.radians(a[0])))


def main():
    gt = json.load(open(sys.argv[1]))
    cr = json.load(open(DATA / "wiki" / "cross-reference.json"))

    coords = {}
    for rel, prefix in (("buildings/buildings.json", "building"),):
        for x in json.load(open(DATA / rel)):
            coords[f"{prefix}:{x['id']}"] = (x["lat"], x["lng"])
    for f in (DATA / "unified").glob("*.json"):
        for x in json.load(open(f)):
            if x.get("lat") is not None:
                coords[str(x["id"])] = (x["lat"], x["lng"])

    groups = defaultdict(list)
    for k, e in cr.items():
        if e.get("qid") and not k.startswith("wd-"):
            groups[e["qid"]].append(k)

    plan = {"merge": [], "strip": [], "demote": [], "manual": []}
    for qid, keys in sorted(groups.items()):
        if len(keys) < 2:
            continue
        g = gt.get(qid) or {}
        classes = [c.lower() for c in (g.get("instanceOfLabels") or [])]
        if not classes:
            plan["manual"].append({"qid": qid, "keys": keys, "why": "no instanceOf"})
            continue
        bearers, imposters = [], []
        for k in keys:
            alien = ALIEN.get(kind_of(k), [])
            (imposters if any(a in c for a in alien for c in classes)
             else bearers).append(k)
        # anchors: places a structure can honestly be "located in"
        settlement_qid = any(w in c for w in
                             ("city", "town", "village", "settlement", "commune",
                              "municipality", "colony", "oppidum",
                              "archaeological site", "hill", "island", "ruins")
                             for c in classes)
        for k in imposters:
            if settlement_qid and kind_of(k) != "settlement":
                plan["demote"].append({"key": k, "qid": qid, "label": g.get("label"),
                                       "why": f"place-anchor QID on '{kind_of(k)}' record"})
            else:
                plan["strip"].append({"key": k, "qid": qid, "label": g.get("label"),
                                      "why": f"kind '{kind_of(k)}' vs {classes[:3]}"})
        # aspect records bearing a pure settlement QID: demote them too —
        # identity with a town belongs to settlement records only
        pure_settlement = settlement_qid and not any(
            s in c for s in ("temple", "church", "villa", "amphitheatre", "aqueduct",
                             "bridge", "bath", "tomb", "sanctuary", "basilica",
                             "archaeological site")
            for c in classes)
        if pure_settlement:
            still = [k for k in bearers if kind_of(k) not in ("settlement", "pleiades")]
            for k in still:
                bearers.remove(k)
                plan["demote"].append({"key": k, "qid": qid, "label": g.get("label"),
                                       "why": f"pure settlement QID on '{kind_of(k)}' record"})
        if len(bearers) >= 2:
            # sanity: bearers of one entity sit together — but "together" is
            # kind-relative: harbor systems span a bay (Alexandria's Portus
            # Magnus ~10 km), aqueducts are linear (the Gier runs 85 km),
            # point-like structures should nearly coincide.
            # a group takes the most permissive cap among its members'
            # kinds: an aqueduct's pleiades survey point is still a point on
            # that aqueduct (Rome's aqueducts run ~90 km end to end)
            SPREAD_CAP = {"port": 15.0, "aqueduct": 100.0,
                          # mine QIDs cover districts (Skouriotissa's workings
                          # span km); wreck coords differ across catalogs;
                          # presses anchor to their site's survey point
                          "mine": 10.0, "shipwreck": 5.0, "press": 8.0}
            cap = max(SPREAD_CAP.get(kind_of(k), 3.0) for k in bearers)
            pts = [coords[k] for k in bearers if k in coords]
            spread = max((km(a, b) for a in pts for b in pts), default=0)
            if spread <= cap:
                plan["merge"].append({"qid": qid, "keys": bearers,
                                      "label": g.get("label")})
            else:
                plan["manual"].append({"qid": qid, "keys": bearers,
                                       "why": f"bearers {spread:.1f} km apart"})

    dump_atomic(plan, DATA / "review" / "same-qid-plan.json", ensure_ascii=False, indent=1)
    print(f"merge groups: {len(plan['merge'])}, strips: {len(plan['strip'])}, "
          f"demotes: {len(plan['demote'])}, manual: {len(plan['manual'])}")
    for m in plan["merge"][:6]:
        print("  MERGE", m["label"], m["keys"])
    for s in plan["strip"][:6]:
        print("  STRIP", s["key"], "<-", s["label"], "|", s["why"])


if __name__ == "__main__":
    main()
