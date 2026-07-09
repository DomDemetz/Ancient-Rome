#!/usr/bin/env python3
"""Annotate the wd-settlements snapshot with Wikidata instance-of (P31).

4,090 of the imported settlements have UNKNOWN inception encoded as
startYear 0 — under the atlas's '0 = unknown = always visible' rule,
20th-century ghost towns (Kansas, Chernobyl-zone Belarus) render in
753 BC. Their P31 type is the signal that separates Corioli (ancient
city, unknown founding) from Crisfield (modern village, unknown
founding): this fetches P31 for every zero-start entry and stores the
QIDs in a `types` field. build-entities.py decides from there.
Resumable; only fetches entries without `types`.
"""

import json
import os
import sys
import time
import urllib.request
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic


BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")
SRC = os.path.join(BASE, "registry", "wd-settlements.json")
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


def main():
    src = json.load(open(SRC))
    todo = [e for e in src if e["startYear"] == 0 and "types" not in e]
    print(f"zero-start entries needing types: {len(todo)}")
    for i in range(0, len(todo), 50):
        batch = todo[i : i + 50]
        ids = "|".join(e["qid"] for e in batch)
        url = (
            "https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims"
            f"&format=json&ids={ids}"
        )
        data = get(url)
        for e in batch:
            ent = (data.get("entities") or {}).get(e["qid"]) or {}
            claims = (ent.get("claims") or {}).get("P31") or []
            e["types"] = sorted(
                {
                    c["mainsnak"]["datavalue"]["value"]["id"]
                    for c in claims
                    if c.get("mainsnak", {}).get("datavalue")
                }
            )
        if (i // 50) % 10 == 0:
            print(f"  {i + len(batch)}/{len(todo)}")
            dump_atomic(src, SRC, ensure_ascii=False, separators=(",", ":"))
        time.sleep(0.3)
    with open(SRC, "w") as f:
        json.dump(src, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print("done")


if __name__ == "__main__":
    main()
