#!/usr/bin/env python3
"""
Enrich battles that lack wiki entries (notably the 13 byzantine-curated ones)
into battles-wiki.json via their crosswalk QIDs — same schema, same pipeline.
Idempotent.
"""
import json, os, time, urllib.error, urllib.request, urllib.parse
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic


BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")
UA = {"User-Agent": "AncientRomeAtlas/1.0 (open-source history atlas)"}

def get(url, tries=4):
    for i in range(tries):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30))
        except urllib.error.HTTPError as ex:
            if ex.code == 429 and i < tries - 1:
                time.sleep(20 * (i + 1)); continue
            raise

battles = json.load(open(os.path.join(BASE, "battles", "battles.json")))
xw = json.load(open(os.path.join(BASE, "registry", "crosswalk-battles.json")))
wpath = os.path.join(BASE, "wiki", "battles-wiki.json")
wiki = json.load(open(wpath))

todo = [(b["id"], xw[b["id"]]["qid"]) for b in battles if b["id"] not in wiki and b["id"] in xw]
print(f"battles lacking wiki entries but having QIDs: {len(todo)}")

added = failed = 0
for i in range(0, len(todo), 50):
    chunk = todo[i:i+50]
    ids = "|".join(q for _, q in chunk)
    ents = get(f"https://www.wikidata.org/w/api.php?action=wbgetentities&ids={ids}&props=sitelinks&sitefilter=enwiki&format=json")
    for bid, qid in chunk:
        title = ents.get("entities", {}).get(qid, {}).get("sitelinks", {}).get("enwiki", {}).get("title")
        if not title:
            continue
        try:
            s = get("https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(title.replace(" ", "_")))
            extract = s.get("extract", "")
            if not extract:
                continue
            entry = {
                "wikiTitle": title, "wikidataId": qid, "resolvedVia": "wikidata-search",
                "confidence": 0.85, "extract": extract, "romanEraExtract": extract,
                "wikipediaUrl": f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}",
                "wikidataUrl": f"https://www.wikidata.org/wiki/{qid}",
                "fetchedAt": "2026-07-04T00:00:00.000Z",
            }
            if s.get("thumbnail"):
                t = s["thumbnail"]
                entry["thumbnail"] = {"url": t["source"], "width": t["width"], "height": t["height"]}
            wiki[bid] = entry
            added += 1
            time.sleep(0.2)
        except Exception:
            failed += 1
    time.sleep(2)

dump_atomic(wiki, wpath, ensure_ascii=False, indent=1, sort_keys=True)
open(wpath, "a").write("\n")
print(f"battles-wiki.json: +{added} entries (failed {failed}) -> {len(wiki)} total")
