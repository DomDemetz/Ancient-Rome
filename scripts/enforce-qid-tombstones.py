#!/usr/bin/env python3
"""Re-remove deliberately-removed QID links that later passes resurrected.

Every qid removal/demotion is recorded in review/qid-cleanup-log.json.
Geo-matchers and enrichment passes keep re-discovering the same wrong
links (they match by proximity, and the wrong QID is usually nearby) —
the Lyon aqueducts got the Gier's QID back two days after it was
stripped. This script treats the cleanup log as a tombstone list and
re-applies it. Run after any enrichment/matching pass; the validator's
resurrected-qid rule fails CI if this is forgotten.

A tombstone is void only if a LATER log entry explicitly restored that
same (key, qid) as identity (the self-reference restorations).

Usage: python3 scripts/enforce-qid-tombstones.py [--dry-run]
"""

import json
import sys
from pathlib import Path
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic


DATA = Path(__file__).resolve().parent.parent / "src" / "data"
WD_FIELDS = ["wdProps", "label", "wikidataDescription"]


def load_tombstones():
    log = json.load(open(DATA / "review" / "qid-cleanup-log.json"))
    tombs, restored = set(), set()
    for e in log:  # log is append-only, so later entries win
        pair = (e["key"], e["qid"])
        action = e.get("action", "")
        if action.startswith(("removed-qid", "qid->containedInQid")):
            tombs.add(pair)
            restored.discard(pair)
        elif "->qid" in action:  # e.g. containedInQid->qid restorations
            restored.add(pair)
            tombs.discard(pair)
    return tombs - restored


def main():
    dry = "--dry-run" in sys.argv
    tombs = load_tombstones()

    cr = json.load(open(DATA / "wiki" / "cross-reference.json"))
    fixed = 0
    for k, e in cr.items():
        if e.get("qid") and (k, e["qid"]) in tombs:
            e.pop("qid")
            for f in WD_FIELDS:
                e.pop(f, None)
            fixed += 1
    if fixed and not dry:
        dump_atomic(cr, DATA / "wiki" / "cross-reference.json", ensure_ascii=False, indent=1)

    silo_fixed = 0
    for f in sorted((DATA / "unified").glob("*.json")):
        items = json.load(open(f))
        n = 0
        for x in items:
            k = str(x.get("id"))
            if x.get("qid") and (k, x["qid"]) in tombs:
                del x["qid"]
                n += 1
        if n and not dry:
            dump_atomic(items, f, ensure_ascii=False, indent=1)
        silo_fixed += n

    b_path = DATA / "buildings" / "buildings.json"
    b = json.load(open(b_path))
    n = 0
    for x in b:
        k = f"building:{x['id']}"
        if x.get("qid") and (k, x["qid"]) in tombs:
            del x["qid"]
            n += 1
    if n and not dry:
        dump_atomic(b, b_path, ensure_ascii=False, indent=1)
    silo_fixed += n

    print(f"tombstones: {len(tombs)}; re-removed: {fixed} cross-ref, {silo_fixed} silo"
          f"{' (DRY RUN)' if dry else ''}")


if __name__ == "__main__":
    main()
