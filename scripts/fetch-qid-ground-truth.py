#!/usr/bin/env python3
"""Fetch Wikidata ground truth for every QID used by non-wd cross-reference
records: label, description, instance-of (P31), coords (P625), dates
(P571/P576). Output feeds the QID-verification swarm.

Usage: python3 scripts/fetch-qid-ground-truth.py <out.json>
"""

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "src" / "data"
API = "https://www.wikidata.org/w/api.php"
UA = "AncientRomeAtlas-data-audit/1.0 (nsoulfield@gmail.com)"


def api_get(params):
    qs = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{API}?{qs}", headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            wait = 2 ** (attempt + 1)
            print(f"  retry in {wait}s: {e}", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("API failed after retries")


def year_of(claim):
    try:
        t = claim["mainsnak"]["datavalue"]["value"]["time"]  # +1952-01-01T...
        return int(t[0:5].replace("+", ""))
    except (KeyError, ValueError, TypeError):
        return None


def main():
    out_path = sys.argv[1]
    cr = json.load(open(DATA / "wiki" / "cross-reference.json"))
    qids = sorted({e["qid"] for k, e in cr.items()
                   if e.get("qid") and not k.startswith("wd-")})
    print(f"fetching {len(qids)} QIDs")

    result = {}
    for i in range(0, len(qids), 50):
        batch = qids[i:i + 50]
        data = api_get({
            "action": "wbgetentities", "ids": "|".join(batch),
            "props": "labels|descriptions|claims", "languages": "en",
            "format": "json", "maxlag": "5",
        })
        for qid, ent in (data.get("entities") or {}).items():
            if "missing" in ent:
                result[qid] = {"missing": True}
                continue
            claims = ent.get("claims", {})
            p31 = []
            for c in claims.get("P31", [])[:6]:
                try:
                    p31.append(c["mainsnak"]["datavalue"]["value"]["id"])
                except (KeyError, TypeError):
                    pass
            coord = None
            try:
                v = claims["P625"][0]["mainsnak"]["datavalue"]["value"]
                coord = [round(v["latitude"], 4), round(v["longitude"], 4)]
            except (KeyError, IndexError, TypeError):
                pass
            result[qid] = {
                "label": ent.get("labels", {}).get("en", {}).get("value"),
                "description": ent.get("descriptions", {}).get("en", {}).get("value"),
                "instanceOf": p31,
                "coord": coord,
                "inception": year_of(claims["P571"][0]) if claims.get("P571") else None,
                "dissolved": year_of(claims["P576"][0]) if claims.get("P576") else None,
            }
        print(f"  {min(i + 50, len(qids))}/{len(qids)}")
        time.sleep(0.3)

    # resolve P31 class QIDs to labels in a second pass
    class_qids = sorted({c for v in result.values()
                         for c in v.get("instanceOf", [])})
    class_labels = {}
    for i in range(0, len(class_qids), 50):
        batch = class_qids[i:i + 50]
        data = api_get({"action": "wbgetentities", "ids": "|".join(batch),
                        "props": "labels", "languages": "en", "format": "json",
                        "maxlag": "5"})
        for qid, ent in (data.get("entities") or {}).items():
            class_labels[qid] = ent.get("labels", {}).get("en", {}).get("value", qid)
        time.sleep(0.3)
    for v in result.values():
        v["instanceOfLabels"] = [class_labels.get(c, c)
                                 for c in v.get("instanceOf", [])]

    json.dump(result, open(out_path, "w"), ensure_ascii=False, indent=0)
    print(f"wrote {len(result)} entities -> {out_path}")


if __name__ == "__main__":
    main()
