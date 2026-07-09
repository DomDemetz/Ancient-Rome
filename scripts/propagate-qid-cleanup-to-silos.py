#!/usr/bin/env python3
"""Propagate QID-verdict cleanups from cross-reference.json into the silo
files, so the clean state lives in the sources, not just the enrichment
store.

For every record in review/qid-cleanup-log.json (wrong-entity removals and
related->containedInQid moves), remove the stale `qid` from:
  - src/data/unified/<type>.json   (same key scheme as cross-reference)
  - src/data/buildings/buildings.json  (building:<id> -> id)
  - src/data/places/places.json       (settlement:<dareId> -> dare-<id>)

Usage: python3 scripts/propagate-qid-cleanup-to-silos.py [--dry-run]
"""

import json
import sys
from collections import Counter
from pathlib import Path
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic


DATA = Path(__file__).resolve().parent.parent / "src" / "data"


def main():
    dry = "--dry-run" in sys.argv
    log = json.load(open(DATA / "review" / "qid-cleanup-log.json"))
    # key -> qid that was rejected for that record
    rejected = {e["key"]: e["qid"] for e in log}
    counts = Counter()

    # unified/*.json — ids match cross-reference keys
    for f in sorted((DATA / "unified").glob("*.json")):
        items = json.load(open(f))
        changed = 0
        for x in items:
            key = str(x.get("id"))
            if key in rejected and x.get("qid") == rejected[key]:
                del x["qid"]
                changed += 1
        if changed and not dry:
            dump_atomic(items, f, ensure_ascii=False, indent=1)
        counts[f"unified/{f.name}"] = changed

    # buildings.json
    b = json.load(open(DATA / "buildings" / "buildings.json"))
    changed = 0
    for x in b:
        key = f"building:{x['id']}"
        if key in rejected and x.get("qid") == rejected[key]:
            del x["qid"]
            changed += 1
    if changed and not dry:
        dump_atomic(b, DATA / "buildings" / "buildings.json", ensure_ascii=False, indent=1)
    counts["buildings.json"] = changed

    # places.json — settlement:<dareId> keys map to place id dare-<id>
    p = json.load(open(DATA / "places" / "places.json"))
    dare_rejected = {k.split(":")[1]: q for k, q in rejected.items()
                     if k.startswith("settlement:")}
    changed = 0
    for x in p:
        did = str((x.get("dare") or {}).get("id"))
        if did in dare_rejected and x.get("qid") == dare_rejected[did]:
            del x["qid"]
            changed += 1
    if changed and not dry:
        dump_atomic(p, DATA / "places" / "places.json", ensure_ascii=False, separators=(",", ":"))
    counts["places.json"] = changed

    total = sum(counts.values())
    for k, n in counts.most_common():
        if n:
            print(f"  {k}: {n} stale qids removed")
    print(f"total: {total}{' (DRY RUN)' if dry else ''}")


if __name__ == "__main__":
    main()
