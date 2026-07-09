#!/usr/bin/env python3
"""Apply review/same-qid-plan.json (from resolve-same-qid-groups.py).

  demote: qid -> containedInQid in cross-reference; qid removed from silos
  strip:  qid removed from cross-reference (with wd fields) and silos
  merge:  written to src/data/entities/same-qid-links.json — consumed by
          build-entity-table.py as unconditional unions

All changes append to review/qid-cleanup-log.json.

Usage: python3 scripts/apply-same-qid-plan.py [--dry-run]
"""

import json
import sys
from pathlib import Path
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic


DATA = Path(__file__).resolve().parent.parent / "src" / "data"
WD_FIELDS = ["wdProps", "label", "wikidataDescription"]


def strip_from_silos(key_qids, dry):
    changed = {}
    for f in sorted((DATA / "unified").glob("*.json")):
        items = json.load(open(f))
        n = 0
        for x in items:
            k = str(x.get("id"))
            if k in key_qids and x.get("qid") == key_qids[k]:
                del x["qid"]
                n += 1
        if n and not dry:
            dump_atomic(items, f, ensure_ascii=False, indent=1)
        if n:
            changed[f.name] = n
    return changed


def main():
    dry = "--dry-run" in sys.argv
    plan = json.load(open(DATA / "review" / "same-qid-plan.json"))
    cr = json.load(open(DATA / "wiki" / "cross-reference.json"))
    log = []

    demote_keys = {}
    for d in plan["demote"]:
        e = cr.get(d["key"])
        if e and e.get("qid") == d["qid"]:
            e["containedInQid"] = e.pop("qid")
            for f in WD_FIELDS:
                e.pop(f, None)
            demote_keys[d["key"]] = d["qid"]
            log.append({"key": d["key"], "action": "qid->containedInQid",
                        "qid": d["qid"], "reason": d["why"], "confidence": "high"})

    strip_keys = {}
    for s in plan["strip"]:
        e = cr.get(s["key"])
        if e and e.get("qid") == s["qid"]:
            e.pop("qid")
            for f in WD_FIELDS:
                e.pop(f, None)
            strip_keys[s["key"]] = s["qid"]
            log.append({"key": s["key"], "action": "removed-qid-and-wd-fields",
                        "qid": s["qid"], "reason": s["why"], "confidence": "high"})

    silo_changes = strip_from_silos({**demote_keys, **strip_keys}, dry)

    links = [{"qid": m["qid"], "keys": m["keys"], "label": m["label"]}
             for m in plan["merge"]]

    print(f"demoted: {len(demote_keys)}, stripped: {len(strip_keys)}, "
          f"merge links: {len(links)}, silo qid removals: {sum(silo_changes.values())}")
    if dry:
        print("DRY RUN — nothing written")
        return

    dump_atomic(cr, DATA / "wiki" / "cross-reference.json", ensure_ascii=False, indent=1)
    dump_atomic(links, DATA / "entities" / "same-qid-links.json", ensure_ascii=False, indent=1)
    log_path = DATA / "review" / "qid-cleanup-log.json"
    prev = json.load(open(log_path)) if log_path.exists() else []
    seen = {(e["key"], e.get("action")) for e in prev}
    prev += [e for e in log if (e["key"], e.get("action")) not in seen]
    dump_atomic(prev, log_path, ensure_ascii=False, indent=1)
    print("written: cross-reference, entities/same-qid-links.json, cleanup log")


if __name__ == "__main__":
    main()
