#!/usr/bin/env python3
"""
Ingest new Pleiades entities into our unified datasets.
Deduplicates by spatial proximity + name overlap.

Usage:
  python scripts/ingest-pleiades-new.py --dry-run
  python scripts/ingest-pleiades-new.py
"""

import json
import os
import sys
from collections import defaultdict
from math import radians, sin, cos, sqrt, atan2

NEW_ENTITIES_PATH = "src/data/downloads/pleiades-new-entities.json"
QIDS_PATH = "src/data/downloads/pleiades-qids.json"
UNIFIED = "src/data/unified"

# Map Pleiades types to our dataset files
TYPE_MAP = {
    "villa": "discovery-villa.json",
    "temple-2": "discovery-temple.json",
    "bridge": "discovery-bridge.json",
    "tomb": "discovery-tomb.json",
    "aqueduct": "aqueduct.json",
    "sanctuary": "religious-site.json",
    "church": "religious-site.json",
    "temple": "discovery-temple.json",
    "bath": "building.json",
    "fort": "building.json",
    "monument": "building.json",
    "theater": "building.json",
    "amphitheatre": "amphitheater.json",
    "mine": "mine.json",
    "cemetery": "discovery-tomb.json",
}

# Map to our entity type field
ENTITY_TYPE = {
    "discovery-villa.json": "villa",
    "discovery-temple.json": "temple",
    "discovery-bridge.json": "bridge",
    "discovery-tomb.json": "tomb",
    "aqueduct.json": "aqueduct",
    "religious-site.json": "religious",
    "building.json": "building",
    "amphitheater.json": "amphitheater",
    "mine.json": "mine",
}

SUBTYPE_MAP = {
    "villa": "villa",
    "temple-2": "temple",
    "temple": "temple",
    "bridge": "bridge",
    "tomb": "tomb",
    "aqueduct": "aqueduct",
    "sanctuary": "sanctuary",
    "church": "church",
    "bath": "bath",
    "fort": "fort",
    "monument": "monument",
    "theater": "theater",
    "amphitheatre": "amphitheater",
    "mine": "mine",
    "cemetery": "cemetery",
}


def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))


def build_existing_index(datasets):
    """Build spatial index of all existing entities for dedup."""
    grid = defaultdict(list)
    for entities in datasets.values():
        for e in entities:
            key = (round(e['lat'], 3), round(e['lng'], 3))
            grid[key].append(e.get('name', '').lower())
    return grid


def is_duplicate(entity, grid):
    """Check if entity overlaps with existing data."""
    key = (round(entity['lat'], 3), round(entity['lng'], 3))
    nearby_names = grid.get(key, [])
    title = entity.get('title', '').lower()
    if any(n in title or title in n for n in nearby_names if len(n) > 3):
        return True
    return False


def to_unified(pleiades_entity, target_file, qid_map):
    """Convert Pleiades entity to UnifiedEntity format."""
    pid = pleiades_entity['pid']
    entity_type = ENTITY_TYPE.get(target_file, 'unknown')
    pleiades_type = None
    for t in pleiades_entity.get('types', []):
        if t in TYPE_MAP and TYPE_MAP[t] == target_file:
            pleiades_type = t
            break

    subtype = SUBTYPE_MAP.get(pleiades_type, '') if pleiades_type else ''

    entity = {
        'id': f'{entity_type}:pleiades-{pid}',
        'type': entity_type,
        'name': pleiades_entity['title'],
        'lat': round(pleiades_entity['lat'], 5),
        'lng': round(pleiades_entity['lng'], 5),
        'source': 'Pleiades',
        'description': pleiades_entity.get('description', ''),
    }

    if subtype:
        entity['subtype'] = subtype

    raw_qid = qid_map.get(pid, '')
    if raw_qid:
        import re
        m = re.match(r'(Q\d+)', raw_qid)
        if m:
            entity['qid'] = m.group(1)

    # Estimated temporal data for Roman era
    defaults = {
        'discovery-villa.json': (-100, 500),
        'discovery-temple.json': (-500, 400),
        'discovery-bridge.json': (-200, 500),
        'discovery-tomb.json': (-600, 500),
        'aqueduct.json': (-300, 500),
        'religious-site.json': (-500, 500),
        'building.json': (-200, 500),
        'amphitheater.json': (-100, 400),
        'mine.json': (-300, 500),
    }

    if target_file in defaults:
        start, end = defaults[target_file]
        entity['startYear'] = start
        entity['endYear'] = end
        entity['estimatedTemporal'] = True

    return entity


def main():
    dry_run = '--dry-run' in sys.argv

    new_entities = json.load(open(NEW_ENTITIES_PATH))
    print(f"New Pleiades entities: {len(new_entities)}")

    qid_map = {}
    if os.path.exists(QIDS_PATH):
        qid_map = json.load(open(QIDS_PATH))
        print(f"Pleiades QID mappings: {len(qid_map)}")

    # Load existing datasets
    datasets = {}
    for target_file in set(TYPE_MAP.values()):
        path = f"{UNIFIED}/{target_file}"
        if os.path.exists(path):
            datasets[target_file] = json.load(open(path))
        else:
            datasets[target_file] = []
    print(f"Loaded {sum(len(v) for v in datasets.values())} existing entities across {len(datasets)} datasets")

    # Build dedup index
    grid = build_existing_index(datasets)

    # Route each new entity to its target dataset
    routed = defaultdict(list)
    skipped_no_type = 0
    skipped_dupe = 0

    for entity in new_entities:
        # Find the best matching type
        target = None
        for t in entity.get('types', []):
            if t in TYPE_MAP:
                target = TYPE_MAP[t]
                break

        if not target:
            skipped_no_type += 1
            continue

        if is_duplicate(entity, grid):
            skipped_dupe += 1
            continue

        unified = to_unified(entity, target, qid_map)
        routed[target].append(unified)

        # Add to grid to prevent self-duplicates
        key = (round(entity['lat'], 3), round(entity['lng'], 3))
        grid[key].append(entity['title'].lower())

    print(f"\nSkipped: {skipped_no_type} no matching type, {skipped_dupe} duplicates")
    print(f"\nNew entities per dataset:")

    total_added = 0
    for target_file, new_list in sorted(routed.items()):
        existing_count = len(datasets.get(target_file, []))
        with_qid = sum(1 for e in new_list if e.get('qid'))
        print(f"  {target_file:30s} +{len(new_list):5d} (was {existing_count}, {with_qid} w/QID)")
        total_added += len(new_list)

        if not dry_run:
            datasets[target_file].extend(new_list)
            path = f"{UNIFIED}/{target_file}"
            with open(path, 'w') as f:
                json.dump(datasets[target_file], f, separators=(',', ':'))

    print(f"\nTotal added: {total_added}")
    if dry_run:
        print("(dry run)")


if __name__ == "__main__":
    main()
