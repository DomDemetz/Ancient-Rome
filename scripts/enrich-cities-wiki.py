#!/usr/bin/env python3
"""
Build src/data/wiki/cities-wiki.json — Wikipedia enrichment for the Chandler
cities, in the exact schema of settlements-wiki.json, so CitiesLayer popups
use the same appendWikiTooltip pipeline (thumbnail + extract + Read more).

Sources, in order of preference:
1. Reuse: city -> pid -> DARE twin -> existing settlements-wiki entry (free).
2. Fetch: city QID -> enwiki sitelink -> Wikipedia REST summary (CC-BY-SA).

Idempotent; refetches nothing already present in the output file.
"""
import json, os, time, urllib.error, urllib.request, urllib.parse

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")
OUT = os.path.join(BASE, "wiki", "cities-wiki.json")
UA = {"User-Agent": "AncientRomeAtlas/1.0 (open-source history atlas)"}

cities = json.load(open(os.path.join(BASE, "cities", "historical-cities.json")))
xw_ch = json.load(open(os.path.join(BASE, "registry", "crosswalk-chandler.json")))
xw_da = json.load(open(os.path.join(BASE, "registry", "crosswalk-dare.json")))
setl_wiki = json.load(open(os.path.join(BASE, "wiki", "settlements-wiki.json")))
qids = json.load(open(os.path.join(BASE, "registry", "chandler-qid.json")))

pid_to_dare = {}
for did, e in xw_da.items():
    pid_to_dare.setdefault(e["pid"], did)

out = json.load(open(OUT)) if os.path.exists(OUT) else {}
reused = fetched = failed = 0

def get(url, tries=4):
    for i in range(tries):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30))
        except urllib.error.HTTPError as ex:
            if ex.code == 429 and i < tries - 1:
                time.sleep(20 * (i + 1))
                continue
            raise

# pass 1: reuse DARE twins
need_fetch = []
for c in cities:
    cid = c["id"]
    if cid in out:
        continue
    e = xw_ch.get(cid)
    if e:
        did = pid_to_dare.get(e["pid"])
        if did and did in setl_wiki and not setl_wiki[did].get("wrongArticle"):
            out[cid] = setl_wiki[did]
            reused += 1
            continue
    if cid in qids:
        need_fetch.append((cid, qids[cid]))

# pass 2: batched sitelinks (50 QIDs per request), then REST summaries
titles = {}
for i in range(0, len(need_fetch), 50):
    chunk = need_fetch[i:i+50]
    ids = "|".join(q for _, q in chunk)
    try:
        ents = get(f"https://www.wikidata.org/w/api.php?action=wbgetentities&ids={ids}&props=sitelinks&sitefilter=enwiki&format=json")
        for cid, qid in chunk:
            t = ents.get("entities", {}).get(qid, {}).get("sitelinks", {}).get("enwiki", {}).get("title")
            if t:
                titles[cid] = (qid, t)
    except Exception:
        failed += len(chunk)
    time.sleep(2)

for cid, (qid, title) in titles.items():
    try:
        s = get("https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(title.replace(" ", "_")))
        extract = s.get("extract", "")
        if not extract:
            continue
        entry = {
            "wikiTitle": title,
            "wikidataId": qid,
            "resolvedVia": "wikidata-search",
            "confidence": 0.85,
            "extract": extract,
            "romanEraExtract": extract,
            "wikipediaUrl": f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}",
            "wikidataUrl": f"https://www.wikidata.org/wiki/{qid}",
            "fetchedAt": "2026-07-04T00:00:00.000Z",
        }
        if s.get("thumbnail"):
            t = s["thumbnail"]
            entry["thumbnail"] = {"url": t["source"], "width": t["width"], "height": t["height"]}
        out[cid] = entry
        fetched += 1
        time.sleep(0.2)
    except Exception:
        failed += 1

json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1, sort_keys=True)
open(OUT, "a").write("\n")
print(f"cities-wiki.json: {len(out)} entries (reused {reused}, fetched {fetched}, failed {failed})  {os.path.getsize(OUT)//1024} KB")
