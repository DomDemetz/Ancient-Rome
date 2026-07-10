#!/usr/bin/env python3
"""
Expand territory polygons to fully contain all active DARE provinces at each snapshot year.

For each snapshot year:
1. Load current territory polygon
2. Collect all DARE provinces where startYear <= year <= endYear
3. Union territory + all matching provinces
4. Apply historical exclusion zones
5. Simplify with tol=0.02
6. Save back to territories.json
"""

import json
import sys
from pathlib import Path
from shapely.geometry import shape, mapping, MultiPolygon, Polygon
from shapely.ops import unary_union
from shapely.validation import make_valid

ROOT = Path(__file__).resolve().parent.parent
TERRITORIES_PATH = ROOT / "src/data/territories/territories.json"
PROVINCES_PATH = ROOT / "src/data/dare/provinces.json"

SIMPLIFY_TOLERANCE = 0.02

# Historical exclusion zones: regions that should NOT be in territory before/after certain dates
# Each entry: (name_pattern, box_or_polygon, exclude_before, exclude_after)
# box format: (min_lon, min_lat, max_lon, max_lat)
EXCLUSION_ZONES = [
    # Britain: not before 43 AD
    {
        "name": "Britain",
        "box": (-10, 50, 2, 61),
        "exclude_before": 43,
        "exclude_after": None,
    },
    # Trans-Rhine Germania: never Roman (except Agri Decumates 74-260 AD)
    # We exclude the area east of the Rhine, north of the Danube headwaters
    {
        "name": "Germania east of Rhine",
        "polygon": [
            (6.5, 54.0), (15.0, 54.0), (15.0, 50.5),
            (12.0, 48.0), (10.0, 47.5), (8.5, 47.5),
            (6.5, 50.0), (6.5, 54.0)
        ],
        "exclude_before": None,  # always excluded
        "exclude_after": None,   # always excluded
        "exceptions": [
            # Agri Decumates: small area between Rhine and Danube, 74-260 AD
            {
                "name": "Agri Decumates",
                "polygon": [
                    (8.0, 49.5), (10.0, 49.5), (10.0, 48.5),
                    (9.5, 47.8), (8.5, 47.5), (8.0, 48.0), (8.0, 49.5)
                ],
                "include_from": 74,
                "include_until": 260,
            }
        ],
    },
    # Dacia: only 106-275 AD
    {
        "name": "Dacia",
        "box": (21, 44, 27, 48),
        "exclude_before": 106,
        "exclude_after": 275,
    },
    # Mesopotamia: only from 115 AD
    {
        "name": "Mesopotamia",
        "box": (38, 33, 46, 38),
        "exclude_before": 115,
        "exclude_after": None,
    },
    # Egypt: not before 30 BC
    {
        "name": "Egypt",
        "box": (24, 22, 36, 32),
        "exclude_before": -30,
        "exclude_after": None,
    },
    # Mauretania: not before 40 AD
    {
        "name": "Mauretania",
        "box": (-6, 33, 3, 37),
        "exclude_before": 40,
        "exclude_after": None,
    },
    # Thrace: not before 46 AD
    {
        "name": "Thrace",
        "box": (24, 40.5, 29, 43),
        "exclude_before": 46,
        "exclude_after": None,
    },
    # Arabia Petraea: not before 106 AD
    {
        "name": "Arabia Petraea",
        "box": (34, 27, 40, 33),
        "exclude_before": 106,
        "exclude_after": None,
    },
    # Interior Gaul: not before 50 BC (Caesar's conquest)
    {
        "name": "Interior Gaul",
        "box": (-5, 43.5, 8, 51),
        "exclude_before": -50,
        "exclude_after": None,
    },
    # Alpine provinces (Raetia, Noricum): not before 15 BC
    {
        "name": "Alpine provinces",
        "box": (9, 46, 17, 49),
        "exclude_before": -15,
        "exclude_after": None,
    },
    # Pannonia: not before 9 AD
    {
        "name": "Pannonia",
        "box": (14, 44.5, 21, 48.5),
        "exclude_before": 9,
        "exclude_after": None,
    },
    # Moesia: not before 29 BC (rough)
    {
        "name": "Moesia",
        "box": (19, 42, 29, 45),
        "exclude_before": -29,
        "exclude_after": None,
    },
    # Lycia et Pamphylia: not before 43 AD
    {
        "name": "Lycia et Pamphylia",
        "box": (28, 36, 33, 38),
        "exclude_before": 43,
        "exclude_after": None,
    },
    # Armenia/Mesopotamia (Trajan): not before 114 AD
    {
        "name": "Armenia",
        "box": (38, 36, 46, 42),
        "exclude_before": 114,
        "exclude_after": None,
    },
]


def make_box(min_lon, min_lat, max_lon, max_lat):
    """Create a shapely Polygon from bounding box coordinates."""
    return Polygon([
        (min_lon, min_lat), (max_lon, min_lat),
        (max_lon, max_lat), (min_lon, max_lat),
        (min_lon, min_lat)
    ])


def get_exclusion_geometry(year):
    """Get the combined geometry of all areas that should be excluded at this year."""
    exclusion_polys = []

    for zone in EXCLUSION_ZONES:
        # Determine if this zone should be excluded at this year
        before = zone.get("exclude_before")
        after = zone.get("exclude_after")

        should_exclude = False
        if before is not None and after is not None:
            # Excluded before AND after (like Dacia: only included 106-275)
            should_exclude = (year < before or year > after)
        elif before is not None:
            should_exclude = (year < before)
        elif after is not None:
            should_exclude = (year > after)
        else:
            # Always excluded (like trans-Rhine Germania)
            should_exclude = True

        if not should_exclude:
            continue

        # Build the zone geometry
        if "box" in zone:
            zone_geom = make_box(*zone["box"])
        elif "polygon" in zone:
            zone_geom = Polygon(zone["polygon"])
        else:
            continue

        # Check for exceptions (areas within the zone that ARE included)
        if "exceptions" in zone:
            for exc in zone["exceptions"]:
                inc_from = exc.get("include_from", -9999)
                inc_until = exc.get("include_until", 9999)
                if inc_from <= year <= inc_until:
                    exc_geom = Polygon(exc["polygon"])
                    zone_geom = zone_geom.difference(exc_geom)

        exclusion_polys.append(zone_geom)

    if not exclusion_polys:
        return None
    return unary_union(exclusion_polys)


def geojson_to_shapely(geojson_geom):
    """Convert GeoJSON geometry to shapely, ensuring validity."""
    geom = shape(geojson_geom)
    if not geom.is_valid:
        geom = make_valid(geom)
    return geom


def shapely_to_multipolygon_coords(geom, precision=4):
    """Convert shapely geometry to GeoJSON MultiPolygon coordinates with truncated precision."""
    if geom.is_empty:
        return []

    # Normalize to MultiPolygon
    if isinstance(geom, Polygon):
        geom = MultiPolygon([geom])
    elif not isinstance(geom, MultiPolygon):
        # Could be GeometryCollection after operations
        polys = []
        if hasattr(geom, 'geoms'):
            for g in geom.geoms:
                if isinstance(g, Polygon) and not g.is_empty:
                    polys.append(g)
                elif isinstance(g, MultiPolygon):
                    polys.extend(g.geoms)
        if not polys:
            return []
        geom = MultiPolygon(polys)

    m = mapping(geom)
    coords = m["coordinates"]

    # Truncate coordinates
    def truncate(coord_tree):
        if isinstance(coord_tree, (list, tuple)):
            if len(coord_tree) > 0 and isinstance(coord_tree[0], (int, float)):
                return [round(c, precision) for c in coord_tree]
            return [truncate(c) for c in coord_tree]
        return coord_tree

    return truncate(coords)


def load_data():
    """Load territories and provinces."""
    with open(TERRITORIES_PATH) as f:
        territories = json.load(f)
    with open(PROVINCES_PATH) as f:
        provinces = json.load(f)
    return territories, provinces


def get_active_provinces(provinces, year):
    """Get list of province features active at the given year."""
    active = []
    for feat in provinces["features"]:
        props = feat["properties"]
        start = props.get("startYear", 0)
        end = props.get("endYear", 0)
        if start != 0 and start > year:
            continue
        if end != 0 and end < year:
            continue
        active.append(feat)
    return active


def process_territory(entry, provinces):
    """Expand a single territory entry to contain all active provinces."""
    year = entry["year"]
    tid = entry["id"]
    status = entry.get("status", "controlled")

    # Skip very early snapshots where provinces don't apply yet
    # (Rome was a city-state at -500, -338, -298, -290, -272)
    if year <= -272:
        print(f"  year={year:>5} id={tid:<20} SKIP (too early for province union)")
        return entry

    # Skip lost territories (476 AD western Rome)
    if status == "lost":
        print(f"  year={year:>5} id={tid:<20} SKIP (lost territory)")
        return entry

    # Load current territory geometry
    terr_geom = geojson_to_shapely(entry["boundaries"]["geometry"])
    original_area = terr_geom.area

    # Get active provinces
    active = get_active_provinces(provinces, year)
    if not active:
        print(f"  year={year:>5} id={tid:<20} no active provinces")
        return entry

    # For split empire entries (400, 476 AD), only include provinces
    # that geographically overlap with the existing territory
    is_split_era = (year >= 400)

    # Convert province geometries, filtering by overlap for split eras
    province_geoms = []
    included_names = []
    for feat in active:
        try:
            geom = geojson_to_shapely(feat["geometry"])
            if geom.is_empty:
                continue

            if is_split_era:
                # Only include provinces whose centroid is inside existing territory,
                # or that have >30% overlap with existing territory
                centroid_inside = terr_geom.contains(geom.centroid)
                if not centroid_inside:
                    intersection = terr_geom.intersection(geom)
                    overlap = intersection.area / geom.area if geom.area > 0 else 0
                    if overlap < 0.3:
                        continue

            province_geoms.append(geom)
            included_names.append(feat["properties"]["name"])
        except Exception as e:
            print(f"    WARNING: Failed to parse province {feat['properties']['name']}: {e}")

    # Union territory with matching provinces
    all_geoms = [terr_geom] + province_geoms
    merged = unary_union(all_geoms)

    # Apply exclusion zones, but protect areas covered by active provinces
    exclusion = get_exclusion_geometry(year)
    if exclusion is not None:
        # Province areas should never be excluded — they represent confirmed Roman control
        province_union = unary_union(province_geoms) if province_geoms else None
        if province_union is not None:
            # Only exclude areas NOT covered by any active province
            effective_exclusion = exclusion.difference(province_union)
        else:
            effective_exclusion = exclusion
        merged = merged.difference(effective_exclusion)

    # Ensure valid
    if not merged.is_valid:
        merged = make_valid(merged)

    # Simplify
    simplified = merged.simplify(SIMPLIFY_TOLERANCE, preserve_topology=True)
    if not simplified.is_valid:
        simplified = make_valid(simplified)

    new_area = simplified.area
    pct_change = ((new_area - original_area) / original_area * 100) if original_area > 0 else 0

    # Convert back to coordinates
    new_coords = shapely_to_multipolygon_coords(simplified)
    total_points = sum(len(ring) for poly in new_coords for ring in poly)

    print(f"  year={year:>5} id={tid:<20} provinces={len(active):>2} "
          f"area_change={pct_change:>+6.1f}% points={total_points}")

    # Update the entry
    entry["boundaries"]["geometry"]["coordinates"] = new_coords
    entry["boundaries"]["geometry"]["type"] = "MultiPolygon"

    return entry


def main():
    print("Loading data...")
    territories, provinces = load_data()

    print(f"Territories: {len(territories)} entries")
    print(f"Provinces: {len(provinces['features'])} features")
    print()

    print("Processing territories...")
    for i, entry in enumerate(territories):
        territories[i] = process_territory(entry, provinces)

    # Write output
    print()
    print("Writing updated territories...")
    output = json.dumps(territories, separators=(",", ":"))
    with open(TERRITORIES_PATH, "w") as f:
        f.write(output)

    size_mb = len(output) / (1024 * 1024)
    print(f"Output size: {size_mb:.2f} MB")

    if size_mb > 3.0:
        print("WARNING: File exceeds 3 MB target!")
        sys.exit(1)

    print("Done!")


if __name__ == "__main__":
    main()
