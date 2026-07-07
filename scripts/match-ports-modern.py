#!/usr/bin/env python3
"""
Match ports against the Wikidata geo-index using modern place names
extracted from their descriptions.

Port descriptions contain "Ancient harbour (modern: XYZ)" — we extract XYZ
and match it against nearby Wikidata entities, which typically use modern names.
"""

import json
import os
import re
import sys
from math import radians, sin, cos, sqrt, atan2
from collections import defaultdict

PORTS_PATH = "src/data/unified/port.json"
CROSSREF_PATH = "src/data/wiki/cross-reference.json"
GEO_INDEX_PATH = "src/data/downloads/wikidata-geo-index.json"
CHECKED_PATH = "src/data/downloads/wikidata-checked.json"

MODERN_PATTERN = re.compile(r'\(modern:\s*([^)]+)\)')
RADIUS_KM = 15
SETTLEMENT_TYPES = {
    'Q515',     # city
    'Q3957',    # small town
    'Q532',     # village
    'Q486972',  # human settlement
    'Q5084',    # hamlet
    'Q7930989', # city/town
    'Q15284',   # municipality
    'Q12742',   # commune
    'Q3024240', # historical settlement
    'Q123705',  # neighbourhood
    'Q34763',   # ruins
    'Q839954',  # archaeological site
    'Q44782',   # port
    'Q209',     # port city
}


def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))


def normalize(name):
    name = name.lower().strip()
    for prefix in ['near ', 'at ', 'in ', 'between ', 'on ']:
        if name.startswith(prefix):
            name = name[len(prefix):]
    for suffix in [' area', ' region', ' coast']:
        if name.endswith(suffix):
            name = name[:-len(suffix)]
    return name


def word_overlap_score(name1, name2):
    words1 = set(normalize(name1).split())
    words2 = set(normalize(name2).split())
    if not words1 or not words2:
        return 0
    overlap = len(words1 & words2)
    return overlap / min(len(words1), len(words2))


def build_spatial_grid(geo_index, grid_size=1.0):
    grid = defaultdict(list)
    for qid, data in geo_index.items():
        lat, lng = data['lat'], data['lng']
        key = (int(lat / grid_size), int(lng / grid_size))
        grid[key].append((qid, data))
    return grid


def find_nearby(grid, lat, lng, radius_km, grid_size=1.0):
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


def extract_modern_name(description):
    m = MODERN_PATTERN.search(description)
    if not m:
        return None
    modern = m.group(1).strip()
    # Clean up common prefixes
    for prefix in ['near ', 'at ', 'in ']:
        if modern.lower().startswith(prefix):
            modern = modern[len(prefix):]
    # Take first comma-separated part (usually the place name)
    parts = modern.split(',')
    return parts[0].strip()


def main():
    dry_run = '--dry-run' in sys.argv

    if not os.path.exists(GEO_INDEX_PATH):
        print(f"Geo index not found: {GEO_INDEX_PATH}")
        sys.exit(1)

    print("Loading geo index...", flush=True)
    geo_index = json.load(open(GEO_INDEX_PATH))
    print(f"Loaded {len(geo_index):,} geolocated entities", flush=True)

    print("Building spatial grid...", flush=True)
    grid = build_spatial_grid(geo_index)

    ports = json.load(open(PORTS_PATH))
    crossref = json.load(open(CROSSREF_PATH))

    checked = {}
    if os.path.exists(CHECKED_PATH):
        checked = json.load(open(CHECKED_PATH))
    index_size = len(geo_index)

    no_qid = [p for p in ports if not p.get('qid')]
    print(f"Ports without QID: {len(no_qid)}")

    matched = 0
    skipped = 0

    for port in no_qid:
        eid = port.get('id', '')
        prev = checked.get(eid)
        if prev and prev.get('matched'):
            continue
        # Don't skip unmatched — this is a different matching strategy

        desc = port.get('description', '')
        modern_name = extract_modern_name(desc)
        if not modern_name or len(modern_name) < 3:
            continue

        lat, lng = port.get('lat', 0), port.get('lng', 0)
        if lat == 0 and lng == 0:
            continue

        nearby = find_nearby(grid, lat, lng, RADIUS_KM)

        best = None
        best_score = 0

        for qid, wd_data, dist in nearby:
            wd_label = wd_data.get('label', '')
            if not wd_label:
                continue

            name_score = word_overlap_score(modern_name, wd_label)
            if name_score < 0.5:
                continue

            wd_types = set(wd_data.get('types', []))
            type_match = bool(wd_types & SETTLEMENT_TYPES)

            dist_score = max(0, 1 - dist / RADIUS_KM)

            if name_score >= 0.8 and type_match:
                total_score = 0.9
            elif type_match:
                total_score = name_score * 0.5 + dist_score * 0.3 + 0.2
            else:
                total_score = name_score * 0.5 + dist_score * 0.3

            if total_score > best_score:
                best_score = total_score
                best = {
                    'qid': qid,
                    'label': wd_label,
                    'dist_km': round(dist, 1),
                    'score': round(total_score, 2),
                    'type_match': type_match,
                    'desc': wd_data.get('desc', ''),
                }

        if best and best['score'] >= 0.6 and best['type_match']:
            matched += 1
            ancient = port.get('name', '?')
            print(f"  [{matched}] {ancient[:35]:35s} (modern: {modern_name[:20]:20s}) -> "
                  f"{best['qid']} {best['label']} ({best['dist_km']}km, score={best['score']})")

            checked[eid] = {'checkedAt': index_size, 'matched': True, 'qid': best['qid'], 'via': 'modern-name'}

            if not dry_run:
                port['qid'] = best['qid']
                cr_entry = crossref.get(eid, {})
                cr_entry['qid'] = best['qid']
                cr_entry['label'] = best['label']
                if best.get('desc'):
                    cr_entry['description'] = best['desc']
                crossref[eid] = cr_entry

    print(f"\nMatched: {matched}/{len(no_qid)} ports via modern names")

    if not dry_run and matched > 0:
        with open(PORTS_PATH, 'w') as f:
            json.dump(ports, f, separators=(',', ':'))
        print(f"Saved {PORTS_PATH}")

        with open(CROSSREF_PATH, 'w') as f:
            json.dump(crossref, f, separators=(',', ':'))
        print(f"Updated {CROSSREF_PATH}")

        with open(CHECKED_PATH, 'w') as f:
            json.dump(checked, f, separators=(',', ':'))

    elif dry_run:
        print("(dry run)")


if __name__ == "__main__":
    main()
