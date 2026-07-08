#!/usr/bin/env python3
"""Fetch Wikipedia intros for the Wikidata settlement nodes.

The wd-* nodes carry only name+dates — every popup is empty. This gives
the ones a Roman-atlas user will actually meet (startYear <= 800, wide
Mediterranean box) a real extract + thumbnail:

  QIDs --(wbgetentities, 50/req)--> enwiki titles
       --(query&prop=extracts|pageimages, 20/req)--> intro + thumb

Output: src/data/wiki/wd-wiki.json  { "wd-Q220": {extract, wikiTitle,
wikipediaUrl, thumbnail?}, ... } — consumed by build-knowledge.py.
Resumable: already-fetched ids are skipped on rerun.
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")
OUT = os.path.join(BASE, "wiki", "wd-wiki.json")
UA = "AncientRomeAtlas/1.0 (https://domdemetz.github.io/Ancient-Rome/; data build)"

MAX_START = 800
BOX = (20, 62, -12, 50)  # lat_min, lat_max, lng_min, lng_max


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


def chunks(xs, n):
    for i in range(0, len(xs), n):
        yield xs[i : i + n]


def main():
    places = json.load(open(os.path.join(BASE, "places", "places.json")))
    targets = [
        p
        for p in places
        if p["id"].startswith("wd-")
        and p["startYear"] <= MAX_START
        and BOX[0] <= p["lat"] <= BOX[1]
        and BOX[2] <= p["lng"] <= BOX[3]
    ]
    out = {}
    if os.path.exists(OUT):
        out = json.load(open(OUT))
    todo = [p for p in targets if p["id"] not in out]
    print(f"targets {len(targets)}, already fetched {len(targets) - len(todo)}, todo {len(todo)}")

    # 1) QID -> enwiki title
    titles = {}  # node id -> title
    qid_batches = list(chunks(todo, 50))
    for i, batch in enumerate(qid_batches):
        ids = "|".join(p["qid"] for p in batch)
        url = (
            "https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks"
            f"&sitefilter=enwiki&format=json&ids={ids}"
        )
        data = get(url)
        for p in batch:
            ent = (data.get("entities") or {}).get(p["qid"]) or {}
            t = ((ent.get("sitelinks") or {}).get("enwiki") or {}).get("title")
            if t:
                titles[p["id"]] = t
            else:
                out[p["id"]] = {}  # no enwiki article — cache the miss
        print(f"  sitelinks {i + 1}/{len(qid_batches)} ({len(titles)} titles)")
        time.sleep(0.3)

    # 2) titles -> intro extract + thumbnail
    by_title = {}
    for nid, t in titles.items():
        by_title.setdefault(t, []).append(nid)
    title_list = list(by_title)
    t_batches = list(chunks(title_list, 20))
    for i, batch in enumerate(t_batches):
        q = urllib.parse.quote("|".join(batch))
        url = (
            "https://en.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages"
            "&exintro=1&explaintext=1&exsentences=3&piprop=thumbnail&pithumbsize=320"
            f"&redirects=1&format=json&titles={q}"
        )
        data = get(url)
        pages = (data.get("query") or {}).get("pages") or {}
        # map redirected titles back
        redirect = {
            r["from"]: r["to"] for r in (data.get("query") or {}).get("redirects", [])
        }
        by_final = {}
        for t, nids in by_title.items():
            by_final.setdefault(redirect.get(t, t), []).extend(nids)
        for page in pages.values():
            t = page.get("title")
            for nid in by_final.get(t, []):
                entry = {}
                ext = (page.get("extract") or "").strip()
                if ext:
                    entry["extract"] = ext
                    entry["wikiTitle"] = t
                    entry["wikipediaUrl"] = (
                        "https://en.wikipedia.org/wiki/" + urllib.parse.quote(t.replace(" ", "_"))
                    )
                thumb = (page.get("thumbnail") or {}).get("source")
                if thumb:
                    entry["thumbnail"] = thumb
                out[nid] = entry
        if i % 10 == 0 or i == len(t_batches) - 1:
            print(f"  extracts {i + 1}/{len(t_batches)}")
            with open(OUT, "w") as f:
                json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        time.sleep(0.3)

    with open(OUT, "w") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    got = sum(1 for v in out.values() if v.get("extract"))
    print(f"done: {got} extracts / {len(out)} attempted")


if __name__ == "__main__":
    main()
