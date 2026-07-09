#!/usr/bin/env python3
"""Resolve rebuild-date QIDs to their ancient counterparts.

review/anachronistic-qids.json holds records whose QID has a post-1500
inception but is NOT an unambiguous modern (mostly churches/bridges where
Wikidata's P571 is a rebuild or registration date). Two cases:

  a) The QID covers the modern rebuild and a SEPARATE item exists for the
     ancient structure (St. Peter's Q12512 vs Old St. Peter's Q844922) —
     found via P1365 (replaces) / P1398 (structure replaces). If the
     counterpart's inception is in-window, RELINK the record to it.
  b) The QID is the one continuous entity with a bad/rebuild P571 — no
     ancient counterpart item. KEEP the qid, note the date artifact.

Applies relinks to cross-reference.json (with log entries); writes the
keep/manual remainder back to the review file.

Usage: python3 scripts/resolve-rebuild-counterparts.py [--dry-run]
"""

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from atomic_json import dump_atomic

DATA = Path(__file__).resolve().parent.parent / "src" / "data"
API = "https://www.wikidata.org/w/api.php"
UA = "AncientRomeAtlas-data-audit/1.0 (nsoulfield@gmail.com)"


def api_get(params):
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params),
                                 headers={"User-Agent": UA})
    for a in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception:
            time.sleep(2 ** (a + 1))
    raise RuntimeError("api failed")


def year_of(claim):
    try:
        return int(claim["mainsnak"]["datavalue"]["value"]["time"][0:5].replace("+", ""))
    except (KeyError, ValueError, TypeError):
        return None


def entity_ids(claims, pid):
    out = []
    for c in claims.get(pid, []):
        try:
            out.append(c["mainsnak"]["datavalue"]["value"]["id"])
        except (KeyError, TypeError):
            pass
    return out


def main():
    dry = "--dry-run" in sys.argv
    review = json.load(open(DATA / "review" / "anachronistic-qids.json"))
    cr = json.load(open(DATA / "wiki" / "cross-reference.json"))

    qids = sorted({r["qid"] for r in review})
    print(f"{len(review)} records / {len(qids)} QIDs to resolve")

    # pass 1: fetch replaces-chains for the flagged QIDs
    chains = {}
    for i in range(0, len(qids), 50):
        data = api_get({"action": "wbgetentities", "ids": "|".join(qids[i:i + 50]),
                        "props": "claims", "format": "json", "maxlag": "5"})
        for qid, ent in (data.get("entities") or {}).items():
            cl = ent.get("claims", {})
            chains[qid] = entity_ids(cl, "P1365") + entity_ids(cl, "P1398")
        time.sleep(0.3)

    # pass 2: fetch candidate counterparts' inception + classes
    cand_qids = sorted({c for v in chains.values() for c in v})
    cands = {}
    for i in range(0, len(cand_qids), 50):
        data = api_get({"action": "wbgetentities", "ids": "|".join(cand_qids[i:i + 50]),
                        "props": "labels|claims", "languages": "en",
                        "format": "json", "maxlag": "5"})
        for qid, ent in (data.get("entities") or {}).items():
            cl = ent.get("claims", {})
            cands[qid] = {
                "label": ent.get("labels", {}).get("en", {}).get("value"),
                "inception": year_of(cl["P571"][0]) if cl.get("P571") else None,
            }
        time.sleep(0.3)

    relinked, kept = [], []
    log = []
    for r in review:
        counterparts = [c for c in chains.get(r["qid"], [])
                        if c in cands and (cands[c]["inception"] is None
                                           or cands[c]["inception"] <= 1500)]
        if counterparts:
            new_qid = counterparts[0]
            e = cr.get(r["key"])
            if e is not None and e.get("qid") == r["qid"]:
                e["qid"] = new_qid
                e.pop("wdProps", None)  # facts belonged to the rebuild item
                log.append({"key": r["key"], "action": "relinked->ancient-counterpart",
                            "qid": r["qid"], "newQid": new_qid,
                            "reason": f"{r['label']} replaces {cands[new_qid]['label']} "
                                      f"(inception {cands[new_qid]['inception']})",
                            "confidence": "high"})
                relinked.append({**r, "newQid": new_qid,
                                 "newLabel": cands[new_qid]["label"]})
                continue
        kept.append({**r, "resolution": "kept — continuous entity, P571 is a rebuild/registration artifact"})

    print(f"relinked to ancient counterpart: {len(relinked)}; kept as continuous: {len(kept)}")
    for r in relinked[:8]:
        print(f"  {r['key']}: {r['label']} -> {r['newLabel']} ({r['newQid']})")

    if dry:
        print("DRY RUN — nothing written")
        return
    dump_atomic(cr, DATA / "wiki" / "cross-reference.json", indent=1)
    log_path = DATA / "review" / "qid-cleanup-log.json"
    prev = json.load(open(log_path))
    dump_atomic(prev + log, log_path, indent=1)
    dump_atomic(kept, DATA / "review" / "anachronistic-qids.json", indent=1)
    print("written: cross-reference, cleanup log, review remainder")


if __name__ == "__main__":
    main()
