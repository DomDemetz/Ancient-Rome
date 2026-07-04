#!/usr/bin/env python3
"""
Derive the two SMALL registry artifacts the app loads at runtime:

- registry/dare-suppression.json  {dareId: [start, end]} — a DARE settlement
  that is the same place as a Chandler city (shared Pleiades pid) is hidden
  while its labeled, population-sized Chandler twin is on screen. Kills the
  Rome-has-two-dots problem without losing coverage outside the twin's years.
- registry/chandler-qid.json      {chandlerId: qid} — for popup Wikidata links.

Inputs: the crosswalks (build-place-crosswalks.py). Idempotent.
"""
import json, os
from collections import defaultdict

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")
R = os.path.join(BASE, "registry")

xw_ch = json.load(open(os.path.join(R, "crosswalk-chandler.json")))
xw_da = json.load(open(os.path.join(R, "crosswalk-dare.json")))
cities = {c["id"]: c for c in json.load(open(os.path.join(BASE, "cities", "historical-cities.json")))}

by_pid = defaultdict(list)
for did, e in xw_da.items():
    by_pid[e["pid"]].append(did)

suppress = {}
qids = {}
for cid, e in xw_ch.items():
    c = cities[cid]
    if e.get("qid"):
        qids[cid] = e["qid"]
    for did in by_pid.get(e["pid"], []):
        suppress[did] = [c["startYear"], c["endYear"]]

p1 = os.path.join(R, "dare-suppression.json")
json.dump(suppress, open(p1, "w"), sort_keys=True)
open(p1, "a").write("\n")
p2 = os.path.join(R, "chandler-qid.json")
json.dump(qids, open(p2, "w"), sort_keys=True)
open(p2, "a").write("\n")
print(f"dare-suppression.json: {len(suppress)} twins ({os.path.getsize(p1)} B)")
print(f"chandler-qid.json: {len(qids)} cities with QIDs ({os.path.getsize(p2)} B)")
