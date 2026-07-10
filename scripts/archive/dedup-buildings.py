#!/usr/bin/env python3
"""
Remove entries from building.json that are duplicates of entities
in dedicated datasets (aqueduct, bridge, temple, villa, tomb).

Uses QID matching for exact duplicates and spatial+name matching for likely dupes.
"""

import json
import os
from collections import defaultdict
from math import radians, sin, cos, sqrt, atan2

UNIFIED = "src/data/unified"
BUILDING_PATH = f"{UNIFIED}/building.json"

DEDICATED_FILES = [
    "aqueduct.json",
    "discovery-bridge.json",
    "discovery-temple.json",
    "discovery-villa.json",
    "discovery-tomb.json",
    "amphitheater.json",
]

# Building subtypes that have dedicated datasets
SUBTYPE_TO_FILE = {
    "aqueduct": "aqueduct.json",
    "bridge": "discovery-bridge.json",
    "temple": "discovery-temple.json",
}


def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))


def main():
    buildings = json.load(open(BUILDING_PATH))
    print(f"Buildings: {len(buildings)}")

    # Collect all QIDs from dedicated datasets
    dedicated_qids = set()
    dedicated_spatial = defaultdict(list)  # (rounded_lat, rounded_lng) -> [(name, file)]

    for f in DEDICATED_FILES:
        path = f"{UNIFIED}/{f}"
        if not os.path.exists(path):
            continue
        data = json.load(open(path))
        for e in data:
            if e.get('qid'):
                dedicated_qids.add(e['qid'])
            key = (round(e['lat'], 3), round(e['lng'], 3))
            dedicated_spatial[key].append((e.get('name', '').lower(), f))

    print(f"QIDs in dedicated datasets: {len(dedicated_qids)}")

    # Remove buildings that are QID duplicates
    qid_removed = 0
    spatial_removed = 0
    kept = []

    for b in buildings:
        qid = b.get('qid')
        if qid and qid in dedicated_qids:
            qid_removed += 1
            continue

        # Also check spatial+name match for buildings with subtypes
        # that have dedicated datasets
        subtype = b.get('subtype', '')
        if subtype in SUBTYPE_TO_FILE:
            key = (round(b['lat'], 3), round(b['lng'], 3))
            nearby = dedicated_spatial.get(key, [])
            b_name = b.get('name', '').lower()
            if any(n in b_name or b_name in n for n, f in nearby if len(n) > 3):
                spatial_removed += 1
                continue

        kept.append(b)

    print(f"\nRemoved: {qid_removed} by QID match, {spatial_removed} by spatial+name match")
    print(f"Kept: {len(kept)} (was {len(buildings)})")

    with open(BUILDING_PATH, 'w') as f:
        json.dump(kept, f, separators=(',', ':'))
    print(f"Saved {BUILDING_PATH}")


if __name__ == "__main__":
    main()
