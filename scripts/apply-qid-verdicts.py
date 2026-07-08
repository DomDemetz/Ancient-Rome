#!/usr/bin/env python3
"""Apply the QID-verification swarm's verdicts to the dataset.

Reads verdict files (one per chunk) produced by the qid-verification-swarm
workflow and cleans src/data accordingly:

  wrong-entity (high/medium confidence, skeptic-upheld)
      -> remove qid AND all wd-derived fields (wdProps, label, description,
         wikidataDescription, wikiUrl if wikipedia-derived) from the record.
         The record itself stays — its Pleiades/DARE facts are legitimate.
  related-but-wrong-entity
      -> move qid to "containedInQid" (it's the city/region the thing sits
         in — true information, wrong slot), remove wdProps (those facts
         describe the container, not the structure).
  match / uncertain / low-confidence
      -> untouched.

Every change is logged to src/data/review/qid-cleanup-log.json.

Usage: python3 scripts/apply-qid-verdicts.py <verdicts-dir> [--dry-run]
"""

import json
import sys
from collections import Counter
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "src" / "data"

WD_FIELDS = ["wdProps", "label", "wikidataDescription"]


def main():
    vdir = Path(sys.argv[1])
    dry = "--dry-run" in sys.argv

    verdicts = {}
    for f in sorted(vdir.glob("chunk-*.json")):
        try:
            for v in json.load(open(f)):
                verdicts[v["key"]] = v
        except (json.JSONDecodeError, KeyError) as e:
            print(f"SKIP unreadable verdict file {f.name}: {e}", file=sys.stderr)

    print(f"verdicts loaded: {len(verdicts)}")
    print(Counter(v["verdict"] for v in verdicts.values()).most_common())

    cr = json.load(open(DATA / "wiki" / "cross-reference.json"))
    log = []
    counts = Counter()

    for key, v in verdicts.items():
        e = cr.get(key)
        if e is None or e.get("qid") != v.get("qid"):
            counts["stale"] += 1
            continue
        verdict, conf = v["verdict"], v.get("confidence", "low")

        if verdict == "wrong-entity" and conf in ("high", "medium"):
            removed = {f: e.pop(f) for f in WD_FIELDS if f in e}
            removed["qid"] = e.pop("qid")
            # description often copied from wikidataDescription — drop if identical
            if e.get("description") and e["description"] == removed.get("wikidataDescription"):
                removed["description"] = e.pop("description")
            counts["cleaned-wrong"] += 1
            log.append({"key": key, "action": "removed-qid-and-wd-fields",
                        "qid": v["qid"], "reason": v.get("reason"),
                        "confidence": conf, "removed": sorted(removed)})
        elif verdict == "related-but-wrong-entity" and conf in ("high", "medium"):
            e["containedInQid"] = e.pop("qid")
            removed = {f: e.pop(f) for f in WD_FIELDS if f in e}
            counts["moved-related"] += 1
            log.append({"key": key, "action": "qid->containedInQid, wd-fields removed",
                        "qid": v["qid"], "reason": v.get("reason"),
                        "confidence": conf, "removed": sorted(removed)})
        else:
            counts[f"kept-{verdict}"] += 1

    print()
    for k, n in counts.most_common():
        print(f"  {k}: {n}")

    if dry:
        print("\nDRY RUN — nothing written")
        return

    json.dump(cr, open(DATA / "wiki" / "cross-reference.json", "w"),
              ensure_ascii=False, indent=1)
    review = DATA / "review"
    review.mkdir(exist_ok=True)
    # append to existing log — repeat runs must not erase cleanup history
    log_path = review / "qid-cleanup-log.json"
    if log_path.exists():
        prev = json.load(open(log_path))
        seen_keys = {e["key"] for e in prev}
        log = prev + [e for e in log if e["key"] not in seen_keys]
    json.dump(log, open(log_path, "w"), ensure_ascii=False, indent=1)
    print(f"\ncross-reference.json updated; {len(log)} changes logged to review/qid-cleanup-log.json")


if __name__ == "__main__":
    main()
