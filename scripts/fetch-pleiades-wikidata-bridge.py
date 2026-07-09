#!/usr/bin/env python3
"""
Fetch the Pleiades↔Wikidata identity bridge via property P1584 (Pleiades ID).

One SPARQL query yields every Wikidata item that declares a Pleiades ID —
QID, English label, and coordinates. Joined against our pleiades-all.json,
this is the authority-ID spine for the canonical-entity model: place identity
becomes an ID join instead of fuzzy name matching.

Output: src/data/registry/pleiades-wikidata.json  (only rows matching a place
we actually have), plus match statistics on stdout. Idempotent. CC0 source.
"""
import json, os, urllib.request, urllib.parse
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic


QUERY = """
SELECT ?item ?pid ?itemLabel ?coord WHERE {
  ?item wdt:P1584 ?pid .
  OPTIONAL { ?item wdt:P625 ?coord }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
"""
BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")

url = "https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(QUERY)
req = urllib.request.Request(url, headers={"User-Agent": "AncientRomeAtlas/1.0 (open-source history atlas; entity bridge)"})
data = json.load(urllib.request.urlopen(req, timeout=300))

bridge = {}
for r in data["results"]["bindings"]:
    pid = r["pid"]["value"].strip()
    qid = r["item"]["value"].rsplit("/", 1)[-1]
    label = r.get("itemLabel", {}).get("value", "")
    bridge.setdefault(pid, {"qid": qid, "label": label})
print(f"Wikidata items with a Pleiades ID: {len(bridge)}")

ours = json.load(open(os.path.join(BASE, "pleiades-all.json")))
our_ids = {str(p.get("properties", p).get("id")) for p in ours}
matched = {pid: v for pid, v in bridge.items() if pid in our_ids}
print(f"Our Pleiades places: {len(our_ids)}  ->  with a Wikidata QID: {len(matched)} ({100*len(matched)//len(our_ids)}%)")

out = os.path.join(BASE, "registry", "pleiades-wikidata.json")
os.makedirs(os.path.dirname(out), exist_ok=True)
dump_atomic(matched, out, ensure_ascii=False, indent=1, sort_keys=True)
open(out, "a").write("\n")
print(f"wrote {os.path.relpath(out)} ({os.path.getsize(out)//1024} KB)")
