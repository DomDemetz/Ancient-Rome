#!/usr/bin/env python3
"""
Import Vici.org's own curated identity tables (q_dare, q_pleiades) from the
vici.sql.gz dump — the native cross-references that were dropped when the
data was flattened.

- registry/dare-wikidata.json: native dareId -> QID (no fuzzy matching)
- merges q_pleiades rows into registry/pleiades-wikidata.json where P1584
  didn't already provide a QID
- VALIDATES the fuzzy crosswalk: for DARE ids where both a native QID and a
  fuzzy-derived QID exist, reports the agreement rate.

Requires /private/tmp/vici.sql.gz (from renevoorburg/vici.org, CC-BY-SA).
"""
import gzip, json, os, re

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")
DUMP = "/private/tmp/vici.sql.gz"

q_dare, q_pl = {}, {}
for line in gzip.open(DUMP, "rt", encoding="utf-8", errors="replace"):
    if line.startswith("INSERT INTO `q_dare`"):
        for m in re.finditer(r"\(\d+,'http://www\.wikidata\.org/entity/(Q\d+)',(\d+)\)", line):
            q_dare[m.group(2)] = m.group(1)
    elif line.startswith("INSERT INTO `q_pleiades`"):
        for m in re.finditer(r"\(\d+,'http://www\.wikidata\.org/entity/(Q\d+)',(\d+)\)", line):
            q_pl[m.group(2)] = m.group(1)

# keep only DARE ids we actually have
dare_ids = {str(s["id"]) for s in json.load(open(os.path.join(BASE, "dare", "settlements.json")))}
native = {k: v for k, v in q_dare.items() if k in dare_ids}
out = os.path.join(BASE, "registry", "dare-wikidata.json")
json.dump(native, open(out, "w"), ensure_ascii=False, indent=1, sort_keys=True)
open(out, "a").write("\n")
print(f"dare-wikidata.json: {len(native)} native DARE→QID links (of {len(q_dare)} in dump)")

# merge q_pleiades into the bridge where missing
bpath = os.path.join(BASE, "registry", "pleiades-wikidata.json")
bridge = json.load(open(bpath))
added = 0
for pid, qid in q_pl.items():
    if pid not in bridge:
        bridge[pid] = {"qid": qid, "label": "", "via": "vici-q_pleiades"}
        added += 1
json.dump(bridge, open(bpath, "w"), ensure_ascii=False, indent=1, sort_keys=True)
open(bpath, "a").write("\n")
print(f"bridge: +{added} QIDs from vici's q_pleiades -> {len(bridge)} total")

# VALIDATION: fuzzy crosswalk vs native truth
xw = json.load(open(os.path.join(BASE, "registry", "crosswalk-dare.json")))
agree = disagree = 0
examples = []
for did, e in xw.items():
    fuzzy_qid = e.get("qid")
    nat = native.get(did)
    if fuzzy_qid and nat:
        if fuzzy_qid == nat:
            agree += 1
        else:
            disagree += 1
            if len(examples) < 5:
                examples.append((did, fuzzy_qid, nat))
tot = agree + disagree
print(f"VALIDATION vs native truth: {agree}/{tot} agree ({100*agree//max(1,tot)}%)")
for ex in examples:
    print("  disagree:", ex)
