#!/usr/bin/env python3
"""Drop canonical place nodes that can never render in the atlas window.

The Wikidata settlement ingest (8f5b96f) imported every dated settlement
worldwide; 19,370 of 26,773 have startYear > 1453 (e.g. wd-Q334 Singapore,
1965). The timeline ends at Constantinople's fall, so those nodes are pure
bundle weight (~2.7 MB of places.json). Rerunnable after any re-ingest.

Only wd-* nodes are touched: the archaeological gazetteers encode unknown
dates as 0 and stay authoritative regardless of window.
"""

import json
import sys
from pathlib import Path

ATLAS_END = 1453
PLACES = Path(__file__).parent.parent / "src/data/places/places.json"


def main() -> None:
    places = json.loads(PLACES.read_text())
    before = len(places)
    kept = [
        p
        for p in places
        if not (p["id"].startswith("wd-") and p.get("startYear", 0) > ATLAS_END)
    ]
    dropped = before - len(kept)
    PLACES.write_text(json.dumps(kept, ensure_ascii=False, separators=(",", ":")))
    print(f"places: {before} -> {len(kept)} (dropped {dropped} post-{ATLAS_END} wd nodes)")
    if dropped == 0:
        print("nothing to drop — already filtered")
        sys.exit(0)


if __name__ == "__main__":
    main()
