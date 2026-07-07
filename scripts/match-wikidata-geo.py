#!/usr/bin/env python3
"""
Match our unified entities against the Wikidata geo-index (from dump processing).
Uses spatial proximity + name similarity to find QID matches offline.

This replaces the slow, rate-limited online reconciliation (reconcile-qids.py).

Usage:
  python scripts/match-wikidata-geo.py              # match all datasets
  python scripts/match-wikidata-geo.py battles       # match specific dataset
  python scripts/match-wikidata-geo.py --dry-run     # preview without writing
"""

import json
import os
import sys
import urllib.parse
from math import radians, sin, cos, sqrt, atan2
from collections import defaultdict

UNIFIED_DIR = "src/data/unified"
CROSSREF_PATH = "src/data/wiki/cross-reference.json"
GEO_INDEX_PATH = "src/data/downloads/wikidata-geo-index.json"
CHECKED_PATH = "src/data/downloads/wikidata-checked.json"

# Our datasets and their expected Wikidata P31 types
DATASETS = {
    "battles": {
        "file": "battle.json",
        "types": {"Q178561", "Q188055"},  # battle, siege
        "radius_km": 30,
        "name_threshold": 0.4,
    },
    "shipwrecks": {
        "file": "shipwreck.json",
        "types": {"Q852190"},  # shipwreck
        "radius_km": 20,
        "name_threshold": 0.3,
    },
    "religious-sites": {
        "file": "religious-site.json",
        "types": {"Q16970", "Q34763", "Q162875", "Q2977", "Q44613"},
        "radius_km": 5,
        "name_threshold": 0.4,
    },
    "ports": {
        "file": "port.json",
        "types": {"Q44782", "Q515", "Q7930989"},
        "radius_km": 10,
        "name_threshold": 0.4,
    },
    "mines": {
        "file": "mine.json",
        "types": {"Q820477", "Q839954", "Q2175765"},  # mine, archaeological site
        "radius_km": 10,
        "name_threshold": 0.3,
    },
    "presses": {
        "file": "press.json",
        "types": {"Q839954", "Q41176"},  # archaeological site, building
        "radius_km": 5,
        "name_threshold": 0.3,
    },
    "amphitheaters": {
        "file": "amphitheater.json",
        "types": {"Q11303", "Q24354", "Q839954"},
        "radius_km": 5,
        "name_threshold": 0.4,
    },
    "buildings": {
        "file": "building.json",
        "types": {"Q41176", "Q811979", "Q839954", "Q35112"},
        "radius_km": 3,
        "name_threshold": 0.4,
    },
    "aqueducts": {
        "file": "aqueduct.json",
        "types": {"Q1081138", "Q839954"},
        "radius_km": 15,
        "name_threshold": 0.4,
    },
    "villas": {
        "file": "discovery-villa.json",
        "types": {"Q3947", "Q839954", "Q41176"},
        "radius_km": 3,
        "name_threshold": 0.3,
    },
    "temples": {
        "file": "discovery-temple.json",
        "types": {"Q34763", "Q16970", "Q839954"},
        "radius_km": 3,
        "name_threshold": 0.3,
    },
    "bridges": {
        "file": "discovery-bridge.json",
        "types": {"Q34627", "Q12280", "Q839954"},
        "radius_km": 5,
        "name_threshold": 0.3,
    },
    "tombs": {
        "file": "discovery-tomb.json",
        "types": {"Q131681", "Q381885", "Q839954"},
        "radius_km": 3,
        "name_threshold": 0.3,
    },
}


def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))


def normalize(name):
    """Normalize name for comparison."""
    name = name.lower().strip()
    for prefix in ['battle of ', 'siege of ', 'temple of ', 'church of ',
                   'bridge of ', 'port of ', 'harbour of ', 'mine of ',
                   'basilica of ', 'forum of ']:
        if name.startswith(prefix):
            name = name[len(prefix):]
    return name


def word_overlap_score(name1, name2):
    """Score based on word overlap between two names."""
    words1 = set(normalize(name1).split())
    words2 = set(normalize(name2).split())
    if not words1 or not words2:
        return 0
    overlap = len(words1 & words2)
    return overlap / min(len(words1), len(words2))


def build_spatial_grid(geo_index, grid_size=1.0):
    """Build a spatial grid for fast nearest-neighbor lookups."""
    grid = defaultdict(list)
    for qid, data in geo_index.items():
        lat, lng = data['lat'], data['lng']
        key = (int(lat / grid_size), int(lng / grid_size))
        grid[key].append((qid, data))
    return grid


def find_nearby(grid, lat, lng, radius_km, grid_size=1.0):
    """Find all entities within radius_km of a point."""
    cells_to_check = int(radius_km / (grid_size * 111)) + 2
    center_cell = (int(lat / grid_size), int(lng / grid_size))
    candidates = []

    for dlat in range(-cells_to_check, cells_to_check + 1):
        for dlng in range(-cells_to_check, cells_to_check + 1):
            cell = (center_cell[0] + dlat, center_cell[1] + dlng)
            for qid, data in grid.get(cell, []):
                dist = haversine(lat, lng, data['lat'], data['lng'])
                if dist <= radius_km:
                    candidates.append((qid, data, dist))

    return sorted(candidates, key=lambda x: x[2])


WRONG_TYPE_KEYWORDS = {
    'railway', 'station', 'airport', 'school', 'university', 'hospital',
    'hotel', 'restaurant', 'shopping', 'mall', 'highway', 'motorway',
    'metro', 'tram', 'bus', 'football', 'soccer', 'cricket', 'basketball',
    'cemetery', 'parking', 'garage', 'cinema', 'theater',
    'town hall', 'city hall', 'municipality', 'commune', 'installation sportive',
    'direzione didattica', 'fire station', 'police', 'post office',
    'kindergarten', 'nursery', 'supermarket', 'bank', 'pharmacy',
}

def match_entity(entity, nearby, config):
    """Try to match an entity against nearby Wikidata items."""
    name = entity.get('name', '')
    if not name or len(name) < 2:
        return None

    best_match = None
    best_score = 0

    for qid, wd_data, dist in nearby:
        wd_label = wd_data.get('label', '')
        if not wd_label:
            continue

        # Skip obviously wrong modern entities
        wd_lower = wd_label.lower()
        wd_desc = wd_data.get('desc', '').lower()
        if any(kw in wd_lower or kw in wd_desc for kw in WRONG_TYPE_KEYWORDS):
            continue

        name_score = word_overlap_score(name, wd_label)
        if name_score < config['name_threshold']:
            continue

        # Single-word names are ambiguous — require type match unless
        # the Wikidata description hints at archaeology/history
        name_words = normalize(name).split()
        if len(name_words) == 1 and len(name_words[0]) < 12:
            has_historical_hint = any(h in wd_desc for h in [
                'roman', 'ancient', 'archaeological', 'ruin', 'temple',
                'villa', 'tomb', 'bridge', 'fort', 'amphitheat',
                'aqueduct', 'basilica', 'church', 'mosque', 'synagogue',
                'battle', 'siege', 'mine', 'quarry', 'shipwreck',
            ])
            wd_types_set = set(wd_data.get('types', []))
            if not bool(wd_types_set & config['types']) and not has_historical_hint:
                continue

        # Type matching
        wd_types = set(wd_data.get('types', []))
        type_match = bool(wd_types & config['types'])
        type_bonus = 0.3 if type_match else 0

        # Distance penalty (closer = better)
        dist_score = max(0, 1 - dist / config['radius_km'])

        # High name score with type match = strong signal
        if name_score >= 0.8 and type_match:
            total_score = 0.9
        else:
            total_score = name_score * 0.5 + dist_score * 0.3 + type_bonus * 0.2

        if total_score > best_score:
            best_score = total_score
            best_match = {
                'qid': qid,
                'label': wd_label,
                'dist_km': round(dist, 1),
                'name_score': round(name_score, 2),
                'total_score': round(total_score, 2),
                'type_match': type_match,
                'description': wd_data.get('desc', ''),
                'imageUrl': None,
            }
            if wd_data.get('img'):
                filename = wd_data['img']
                best_match['imageUrl'] = f"https://commons.wikimedia.org/wiki/Special:FilePath/{urllib.parse.quote(filename)}"

    # Require either a type match or very high name overlap
    if best_match:
        if best_match['type_match'] and best_match['total_score'] >= 0.4:
            return best_match
        if best_match['name_score'] >= 0.8 and best_match['total_score'] >= 0.7:
            return best_match
    return None


def main():
    dry_run = '--dry-run' in sys.argv
    target = None
    for arg in sys.argv[1:]:
        if arg != '--dry-run' and arg in DATASETS:
            target = arg

    if not os.path.exists(GEO_INDEX_PATH):
        print(f"Geo index not found: {GEO_INDEX_PATH}")
        print("Run process-wikidata-fast.py first to build it.")
        sys.exit(1)

    print("Loading geo index...", flush=True)
    geo_index = json.load(open(GEO_INDEX_PATH))
    print(f"Loaded {len(geo_index):,} geolocated entities", flush=True)

    print("Building spatial grid...", flush=True)
    grid = build_spatial_grid(geo_index)
    print(f"Grid built: {len(grid):,} cells", flush=True)

    crossref = json.load(open(CROSSREF_PATH))

    # Track checked entities to avoid re-checking on future runs
    # Format: { "entity_id": { "checkedAt": index_size, "matched": bool } }
    checked = {}
    if os.path.exists(CHECKED_PATH):
        checked = json.load(open(CHECKED_PATH))
    index_size = len(geo_index)
    print(f"Previously checked: {len(checked):,} entities", flush=True)

    datasets_to_process = {target: DATASETS[target]} if target else DATASETS

    total_matched = 0
    total_entities = 0
    total_skipped = 0

    for ds_name, config in datasets_to_process.items():
        data_path = f"{UNIFIED_DIR}/{config['file']}"
        if not os.path.exists(data_path):
            print(f"Skipping {ds_name}: {data_path} not found")
            continue

        entities = json.load(open(data_path))
        without_qid = [e for e in entities if not e.get('qid')]

        # Skip entities already checked against an index of similar size
        # Re-check if the index has grown by >50% since last check
        unchecked = []
        skipped = 0
        for e in without_qid:
            eid = e.get('id', '')
            prev = checked.get(eid)
            if prev and not prev.get('matched') and prev.get('checkedAt', 0) > index_size * 0.67:
                skipped += 1
            else:
                unchecked.append(e)

        total_skipped += skipped
        print(f"\n{'='*60}")
        print(f"{ds_name}: {len(unchecked)} to check, {skipped} skipped (of {len(without_qid)} without QID, {len(entities)} total)")

        matched = 0
        for i, entity in enumerate(unchecked):
            eid = entity.get('id', '')
            lat, lng = entity.get('lat', 0), entity.get('lng', 0)
            if lat == 0 and lng == 0:
                checked[eid] = {'checkedAt': index_size, 'matched': False}
                continue

            nearby = find_nearby(grid, lat, lng, config['radius_km'])
            match = match_entity(entity, nearby, config)

            if match:
                matched += 1
                name = entity.get('name', '?')
                dist_str = f"{match['dist_km']}km"
                print(f"  [{matched}] {name} -> {match['qid']} "
                      f"{match['label']} ({dist_str}, score={match['total_score']})")

                checked[eid] = {'checkedAt': index_size, 'matched': True, 'qid': match['qid']}

                if not dry_run:
                    entity['qid'] = match['qid']
                    cr_key = entity['id']
                    cr_entry = crossref.get(cr_key, {})
                    cr_entry['qid'] = match['qid']
                    cr_entry['label'] = match['label']
                    if match.get('description'):
                        cr_entry['description'] = match['description']
                    if match.get('imageUrl') and not cr_entry.get('imageUrl'):
                        cr_entry['imageUrl'] = match['imageUrl']
                    crossref[cr_key] = cr_entry
            else:
                checked[eid] = {'checkedAt': index_size, 'matched': False}

        total_matched += matched
        total_entities += len(unchecked)
        print(f"  Matched: {matched}/{len(unchecked)}")

        if not dry_run and matched > 0:
            with open(data_path, 'w') as f:
                json.dump(entities, f, separators=(',', ':'))
            print(f"  Saved {data_path}")

    if not dry_run:
        if total_matched > 0:
            with open(CROSSREF_PATH, 'w') as f:
                json.dump(crossref, f, separators=(',', ':'))
            print(f"\nCross-reference updated: {CROSSREF_PATH}")

        with open(CHECKED_PATH, 'w') as f:
            json.dump(checked, f, separators=(',', ':'))
        print(f"Checked tracker updated: {len(checked):,} entities in {CHECKED_PATH}")

    print(f"\n{'='*60}")
    print(f"Total: {total_matched}/{total_entities} new matches")
    print(f"Skipped: {total_skipped} already checked (index hasn't grown enough)")
    if dry_run:
        print("(dry run — no files changed)")


if __name__ == "__main__":
    main()
