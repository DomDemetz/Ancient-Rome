#!/usr/bin/env python3
"""
Crosswalk our battles onto Wikidata QIDs (name + year match, ±2y tolerance).

Wikidata was measured as NOT a replacement for the battle data (only 131 Roman
battles carry date+coords there, none carry a structured winner, vs our 361
with outcomes) — so the dataset stays, and gains canonical identity instead.
QIDs let fields be progressively re-derived from CC0 sources and link battles
into the entity graph.

Input: /tmp/wd-battles-probe.json (from the SPARQL probe; re-fetch if absent).
Output: src/data/registry/crosswalk-battles.json  {battleId: {qid, wdLabel}}
"""
import json, os, re, unicodedata, urllib.request, urllib.parse

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")
PROBE = "/tmp/wd-battles-probe.json"

def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()

if not os.path.exists(PROBE):
    q = """SELECT ?b ?bLabel ?date WHERE {
      VALUES ?side { wd:Q17167 wd:Q2277 wd:Q12544 wd:Q42834 wd:Q201038 }
      ?b (wdt:P31/wdt:P279*) wd:Q178561 ; wdt:P710 ?side .
      OPTIONAL { ?b wdt:P585 ?date }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }"""
    url = "https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(q)
    req = urllib.request.Request(url, headers={"User-Agent": "AncientRomeAtlas/1.0"})
    raw = json.load(urllib.request.urlopen(req, timeout=300))["results"]["bindings"]
    probe = {}
    for r in raw:
        qid = r["b"]["value"].rsplit("/", 1)[-1]
        e = probe.setdefault(qid, {"label": r.get("bLabel", {}).get("value", ""), "date": None})
        if "date" in r: e["date"] = r["date"]["value"]
    json.dump(probe, open(PROBE, "w"))

wd = json.load(open(PROBE))

def wd_year(v):
    if not v: return None
    m = re.match(r"(-?\d{1,4})", v)
    return int(m.group(1)) if m else None

index = {}
for qid, e in wd.items():
    label = e.get("label", "")
    if label and not re.fullmatch(r"Q\d+", label):
        index.setdefault(norm(label), []).append((qid, wd_year(e.get("date"))))

battles = json.load(open(os.path.join(BASE, "battles", "battles.json")))
out, stats = {}, {"matched": 0}
for b in battles:
    cands = index.get(norm(b["name"]), [])
    hit = None
    for qid, wy in cands:
        if wy is None or abs(wy - b["year"]) <= 2:
            hit = qid
            break
    if hit:
        out[b["id"]] = {"qid": hit, "wdLabel": wd[hit]["label"]}
        stats["matched"] += 1
path = os.path.join(BASE, "registry", "crosswalk-battles.json")
json.dump(out, open(path, "w"), ensure_ascii=False, indent=1, sort_keys=True)
open(path, "a").write("\n")
print(f"battles: {stats['matched']}/{len(battles)} matched to a Wikidata QID ({os.path.getsize(path)//1024} KB)")
