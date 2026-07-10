#!/usr/bin/env python3
"""Cache Wikidata inception years (P571, fallback P1619) for every QID
we render on the map.

Why: buildings.json construction dates came from Pleiades *period*
starts, not the structure's build date — the Baths of Diocletian
(298 AD) carry constructionYear -30 and label the map at 117 AD.
Wikidata has the real inception for most of these QIDs; this fetches
them once into src/data/registry/wd-inceptions.json so
apply-wd-inceptions.py can tighten the spans offline.

Resumable: QIDs already in the cache are skipped, rerunning only
fetches new ones. A QID with no usable date is cached as null so it
isn't refetched forever.
"""

import json
import os
import sys
import time
import urllib.request

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")
OUT = os.path.join(BASE, "registry", "wd-inceptions.json")
UA = "AncientRomeAtlas/1.0 (https://domdemetz.github.io/Ancient-Rome/; data build)"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))
            print(f"  retry {attempt + 1}: {e}", file=sys.stderr)


def atomic_dump(obj, path):
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        f.write("\n")
    os.replace(tmp, path)


def claim_year(claims, prop):
    """Earliest year among preferred-or-normal rank claims for prop."""
    years = []
    for c in claims.get(prop) or []:
        if c.get("rank") == "deprecated":
            continue
        dv = c.get("mainsnak", {}).get("datavalue")
        if not dv or dv.get("type") != "time":
            continue
        t = dv["value"].get("time", "")  # "+0298-00-00T00:00:00Z" / "-0025-..."
        try:
            years.append(int(t[: t.index("-", 1)].replace("+", "")))
        except (ValueError, IndexError):
            continue
    return min(years) if years else None


def collect_qids():
    import glob
    import re

    qids = set()
    pat = re.compile(r"^Q\d+$")

    def add(v):
        if isinstance(v, str) and pat.match(v):
            qids.add(v)

    for b in json.load(open(os.path.join(BASE, "buildings", "buildings.json"))):
        add(b.get("qid"))
    for f in glob.glob(os.path.join(BASE, "unified", "*.json")):
        d = json.load(open(f))
        items = d if isinstance(d, list) else d.get("features", [])
        for it in items:
            p = it.get("properties", it)
            add(p.get("qid"))
    amph = json.load(open(os.path.join(BASE, "amphitheaters", "amphitheaters.json")))
    items = amph if isinstance(amph, list) else amph.get("features", [])
    for it in items:
        p = it.get("properties", it)
        add(p.get("qid"))
    return qids


def main():
    cache = {}
    if os.path.exists(OUT):
        cache = json.load(open(OUT))
    qids = collect_qids()
    todo = sorted(q for q in qids if q not in cache)
    print(f"qids on map: {len(qids)}, cached: {len(cache)}, to fetch: {len(todo)}")
    for i in range(0, len(todo), 50):
        batch = todo[i : i + 50]
        url = (
            "https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims"
            f"&format=json&ids={'|'.join(batch)}"
        )
        data = get(url)
        for q in batch:
            ent = (data.get("entities") or {}).get(q) or {}
            claims = ent.get("claims") or {}
            y = claim_year(claims, "P571")
            if y is None:
                y = claim_year(claims, "P1619")  # date of official opening
            cache[q] = y
        if (i // 50) % 10 == 0:
            print(f"  {i + len(batch)}/{len(todo)}")
            atomic_dump(cache, OUT)
        time.sleep(0.3)
    atomic_dump(cache, OUT)
    dated = sum(1 for v in cache.values() if v is not None)
    print(f"done — {dated}/{len(cache)} QIDs have an inception year")


if __name__ == "__main__":
    main()
