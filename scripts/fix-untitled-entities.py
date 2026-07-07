#!/usr/bin/env python3
"""
Fix 'Untitled' and 'Unnamed X' entity names by generating descriptive
names from their description, subtype, or nearest known place.

Strategy:
1. If the entity has a useful description, extract a name from it
2. If it has a subtype + source location, use "Subtype near Location"
3. Otherwise use "Subtype (lat, lng)" as last resort
"""

import json
import glob
import os
import re
import sys
from math import radians, sin, cos, sqrt, atan2

UNIFIED_DIR = "src/data/unified"
PLACES_PATH = "src/data/places/places.json"


def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))


def build_place_grid(places):
    grid = {}
    for p in places:
        key = (round(p['lat']), round(p['lng']))
        if key not in grid:
            grid[key] = []
        grid[key].append(p)
    return grid


def find_nearest_place(lat, lng, grid, max_dist_km=100):
    best = None
    best_dist = max_dist_km
    cell_lat = round(lat)
    cell_lng = round(lng)
    for dlat in range(-1, 2):
        for dlng in range(-1, 2):
            key = (cell_lat + dlat, cell_lng + dlng)
            for p in grid.get(key, []):
                d = haversine(lat, lng, p['lat'], p['lng'])
                if d < best_dist:
                    best_dist = d
                    best = p
    return best, best_dist


def extract_name_from_description(desc):
    if not desc:
        return None

    # "Ancient X of Y" or "Roman X at Y" patterns
    m = re.match(r'^(?:An? |The )?(?:ancient|roman|ruined)?\s*(\w[\w\s]{3,30}?)(?:\s+(?:at|of|near|in|on)\s+.+)?[.]', desc, re.I)
    if m:
        candidate = m.group(1).strip()
        skip = {'location', 'place', 'site', 'area', 'region', 'settlement', 'ancient'}
        if candidate.lower() not in skip and len(candidate) > 4:
            return candidate[:50]

    # "X near Y" or "X at Y"
    m = re.match(r'^([\w\s\']{4,40})\s+(?:near|at|in|from|of)\s+', desc, re.I)
    if m:
        candidate = m.group(1).strip()
        skip = {'unnamed', 'untitled', 'unknown', 'a', 'an', 'the'}
        if candidate.lower() not in skip:
            return candidate[:50]

    return None


SUBTYPE_LABELS = {
    'villa': 'Villa',
    'temple': 'Temple',
    'bridge': 'Bridge',
    'tomb': 'Tomb',
    'cemetery': 'Cemetery',
    'church': 'Church',
    'sanctuary': 'Sanctuary',
    'bath': 'Bath',
    'fort': 'Fort',
    'monument': 'Monument',
    'theater': 'Theater',
    'complex': 'Complex',
    'quarry': 'Quarry',
    'mine': 'Mine',
    'aqueduct': 'Aqueduct',
}


def fix_name(entity, grid):
    name = entity.get('name', '').strip()
    if name.lower() not in ('untitled', 'unnamed', 'unknown', ''):
        return None

    desc = entity.get('description', '')
    subtype = entity.get('subtype', entity.get('type', ''))
    lat = entity.get('lat', 0)
    lng = entity.get('lng', 0)
    label = SUBTYPE_LABELS.get(subtype, subtype.title() if subtype else 'Site')

    # Try to extract from description
    from_desc = extract_name_from_description(desc)
    if from_desc:
        return from_desc

    # Use nearest known place
    nearest, dist = find_nearest_place(lat, lng, grid)
    if nearest and dist < 50:
        direction = ""
        if dist > 2:
            if lat > nearest['lat'] + 0.05:
                direction = "N of "
            elif lat < nearest['lat'] - 0.05:
                direction = "S of "
            elif lng > nearest['lng'] + 0.05:
                direction = "E of "
            elif lng < nearest['lng'] - 0.05:
                direction = "W of "
            else:
                direction = "near "
        else:
            direction = "at "
        place_name = nearest.get('name', '')
        if place_name and place_name.lower() not in ('untitled', 'unnamed', 'unknown'):
            return f"{label} {direction}{place_name}"

    # Fallback: type + coordinates
    return f"{label} ({lat:.2f}, {lng:.2f})"


def main():
    dry_run = '--dry-run' in sys.argv

    # Load places for nearest-place lookup
    places = json.load(open(PLACES_PATH))
    grid = build_place_grid(places)
    print(f"Place grid: {len(places)} places")

    total_fixed = 0
    for fpath in sorted(glob.glob(f"{UNIFIED_DIR}/*.json")):
        fname = os.path.basename(fpath)
        data = json.load(open(fpath))

        fixed = 0
        for entity in data:
            new_name = fix_name(entity, grid)
            if new_name:
                entity['name'] = new_name
                fixed += 1

        if fixed:
            print(f"  {fname}: {fixed} names fixed")
            total_fixed += fixed
            if not dry_run:
                with open(fpath, 'w') as f:
                    json.dump(data, f, separators=(',', ':'))

    print(f"\nTotal fixed: {total_fixed}")
    if dry_run:
        print("(dry run)")


if __name__ == "__main__":
    main()
