#!/usr/bin/env python3
"""
Normalize all unified entity files to a consistent schema.

Problems fixed:
1. QID format: some are strings, some are {"label":"...","qid":"Q..."} objects → always string
2. Missing fields: startYear/endYear missing on some types → always present (0 = unknown)
3. Description: buried in props on most entities → promoted to top-level
4. Inconsistent key order → standardized order for readability

Target schema:
{
  "id": "building:12345",
  "type": "building",
  "subtype": "temple",          // optional, only if meaningful
  "name": "Temple of Jupiter",
  "lat": 41.89,
  "lng": 12.48,
  "startYear": -509,            // always present, 0 = unknown
  "endYear": 455,               // always present, 0 = unknown
  "source": "Pleiades",
  "category": "religion",
  "qid": "Q123456",             // always a plain string, null if absent
  "description": "...",         // promoted from props
  "props": { ... }              // type-specific fields only
}
"""

import json
import os

UNIFIED_DIR = "src/data/unified"

KEY_ORDER = [
    "id", "type", "subtype", "name", "lat", "lng",
    "startYear", "endYear", "source", "category", "qid",
    "description", "props"
]

def normalize_qid(qid_val):
    """Normalize QID to a plain string or None."""
    if qid_val is None:
        return None
    if isinstance(qid_val, str):
        return qid_val if qid_val.startswith('Q') else None
    if isinstance(qid_val, dict):
        q = qid_val.get('qid', '')
        return q if q.startswith('Q') else None
    return None

def normalize_entity(entity):
    """Normalize a single entity to the standard schema."""
    result = {}

    # Core fields (always present)
    result['id'] = entity['id']
    result['type'] = entity['type']

    # Subtype (optional)
    if entity.get('subtype'):
        result['subtype'] = entity['subtype']

    result['name'] = entity.get('name', '')
    result['lat'] = entity.get('lat', 0)
    result['lng'] = entity.get('lng', 0)
    result['startYear'] = entity.get('startYear', 0)
    result['endYear'] = entity.get('endYear', 0)
    result['source'] = entity.get('source', '')
    result['category'] = entity.get('category', '')

    # QID — normalize to plain string
    qid = normalize_qid(entity.get('qid'))
    if qid:
        result['qid'] = qid

    # Promote description from props to top level
    props = dict(entity.get('props', {}))
    desc = props.pop('description', None)
    if desc:
        result['description'] = desc

    # Keep remaining props if any
    if props:
        result['props'] = props

    return result

def ordered_entity(entity):
    """Return entity with keys in standard order."""
    ordered = {}
    for key in KEY_ORDER:
        if key in entity:
            ordered[key] = entity[key]
    # Add any remaining keys not in the standard order
    for key in entity:
        if key not in ordered:
            ordered[key] = entity[key]
    return ordered

def main():
    total_qid_fixed = 0
    total_desc_promoted = 0
    total_year_added = 0

    for filename in sorted(os.listdir(UNIFIED_DIR)):
        if not filename.endswith('.json'):
            continue

        filepath = os.path.join(UNIFIED_DIR, filename)
        entities = json.load(open(filepath))

        qid_fixed = 0
        desc_promoted = 0
        year_added = 0

        normalized = []
        for entity in entities:
            # Count changes for reporting
            old_qid = entity.get('qid')
            if isinstance(old_qid, dict):
                qid_fixed += 1

            if entity.get('props', {}).get('description'):
                desc_promoted += 1

            if 'startYear' not in entity:
                year_added += 1
            if 'endYear' not in entity:
                year_added += 1

            norm = normalize_entity(entity)
            normalized.append(ordered_entity(norm))

        # Write back
        with open(filepath, 'w') as f:
            json.dump(normalized, f, separators=(',', ':'))

        changes = []
        if qid_fixed: changes.append(f"{qid_fixed} QIDs fixed")
        if desc_promoted: changes.append(f"{desc_promoted} descriptions promoted")
        if year_added: changes.append(f"{year_added} year fields added")

        if changes:
            print(f"  {filename}: {', '.join(changes)}")

        total_qid_fixed += qid_fixed
        total_desc_promoted += desc_promoted
        total_year_added += year_added

    print(f"\nTotal: {total_qid_fixed} QIDs normalized, "
          f"{total_desc_promoted} descriptions promoted, "
          f"{total_year_added} year fields added")

if __name__ == '__main__':
    main()
