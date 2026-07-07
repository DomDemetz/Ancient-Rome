#!/usr/bin/env python3
"""
Extract Wikidata QIDs from fresh Pleiades download and update our crosswalk.
Fresh Pleiades (Jul 2026) has 42,184 places with 10,921 Wikidata links.
Our old crosswalk has 11,207 mappings — this should add several thousand more.
"""

import gzip
import json
import re

PLEIADES_DUMP = "src/data/downloads/pleiades-places-latest.json.gz"
CROSSWALK_PATH = "src/data/registry/pleiades-wikidata.json"
CROSSREF_PATH = "src/data/wiki/cross-reference.json"

def extract_qid(uri):
    """Extract QID from a Wikidata URI."""
    m = re.search(r'(Q\d+)', uri)
    return m.group(1) if m else None

def main():
    print("Loading fresh Pleiades dump...")
    with gzip.open(PLEIADES_DUMP, 'rt', encoding='utf-8') as f:
        data = json.load(f)

    if isinstance(data, dict) and '@graph' in data:
        places = data['@graph']
    elif isinstance(data, dict) and 'features' in data:
        places = data['features']
    elif isinstance(data, list):
        places = data
    else:
        print(f"Unknown format: {list(data.keys())[:10]}")
        return

    print(f"Total places: {len(places)}")

    # Extract Wikidata links
    pleiades_wikidata = {}
    for place in places:
        props = place.get('properties', place) if 'properties' in place else place

        pid = str(props.get('id', props.get('pid', props.get('uri', ''))))
        # Normalize Pleiades ID (strip URI prefix)
        if '/' in pid:
            pid = pid.rstrip('/').split('/')[-1]
        if not pid or not pid.isdigit():
            # Try extracting from URI
            uri = props.get('uri', props.get('@id', ''))
            m = re.search(r'/places/(\d+)', str(uri))
            if m:
                pid = m.group(1)
            else:
                continue

        title = props.get('title', props.get('name', ''))

        # Look for Wikidata links in various fields
        connections = props.get('connectsWith', []) or []
        references = props.get('references', []) or []

        for item in connections + references:
            uri = ''
            if isinstance(item, str):
                uri = item
            elif isinstance(item, dict):
                uri = item.get('accessURI', '') or item.get('uri', '') or item.get('access_uri', '')
                if not uri:
                    uri = str(item)

            qid = extract_qid(uri)
            if qid and 'wikidata' in uri.lower():
                pleiades_wikidata[pid] = {
                    'label': title,
                    'qid': qid,
                }
                break

    print(f"Extracted {len(pleiades_wikidata)} Pleiades→Wikidata mappings from fresh dump")

    # Load existing crosswalk
    existing = json.load(open(CROSSWALK_PATH))
    existing_count = len(existing)
    print(f"Existing crosswalk: {existing_count} mappings")

    # Merge: add new, update existing if label was empty
    new_count = 0
    updated_count = 0
    for pid, mapping in pleiades_wikidata.items():
        if pid not in existing:
            existing[pid] = mapping
            new_count += 1
        else:
            entry = existing[pid]
            if isinstance(entry, str):
                existing[pid] = {'qid': entry, 'label': mapping.get('label', '')}
                updated_count += 1
            elif not entry.get('label') and mapping.get('label'):
                entry['label'] = mapping['label']
                updated_count += 1

    print(f"New mappings: {new_count}")
    print(f"Updated labels: {updated_count}")
    print(f"Total crosswalk: {len(existing)} mappings")

    # Save updated crosswalk
    with open(CROSSWALK_PATH, 'w') as f:
        json.dump(existing, f, separators=(',', ':'))
    print(f"Wrote {CROSSWALK_PATH}")

    # Now propagate QIDs to unified entity files
    print("\nPropagating QIDs to unified entities...")
    propagate_to_unified(existing)

def propagate_to_unified(crosswalk):
    """Update unified entity files with QIDs from the crosswalk."""
    import os

    unified_dir = "src/data/unified"
    crossref = json.load(open(CROSSREF_PATH))

    total_updated = 0
    total_cr_updated = 0

    for filename in sorted(os.listdir(unified_dir)):
        if not filename.endswith('.json'):
            continue

        filepath = os.path.join(unified_dir, filename)
        entities = json.load(open(filepath))
        updated = 0

        # Determine cross-ref prefix from filename
        cr_prefixes = {
            'building.json': 'building',
            'amphitheater.json': 'amphitheater',
            'discovery-bridge.json': 'discovery-bridge',
            'discovery-temple.json': 'discovery-temple',
            'discovery-tomb.json': 'discovery-tomb',
            'discovery-villa.json': 'discovery-villa',
            'mine.json': 'mine',
            'aqueduct.json': 'aqueduct',
            'port.json': 'port',
            'religious-site.json': 'religion',
            'shipwreck.json': 'shipwreck',
            'press.json': 'press',
            'battle.json': 'battle',
        }
        cr_prefix = cr_prefixes.get(filename)

        for entity in entities:
            if entity.get('qid'):
                continue  # already has QID

            # Try to find a Pleiades ID for this entity
            eid = entity['id']
            pleiades_id = None

            # Check if the entity ID contains a Pleiades-like numeric ID
            # e.g., building entities might have Pleiades-derived IDs
            parts = eid.split(':')[-1].split('-')
            for part in parts:
                if part.isdigit() and len(part) >= 4:
                    if part in crosswalk:
                        pleiades_id = part
                        break

            # Also check props for pleiadesId
            if not pleiades_id:
                pleiades_id = entity.get('props', {}).get('pleiadesId')
                if pleiades_id and pleiades_id not in crosswalk:
                    pleiades_id = None

            if pleiades_id and pleiades_id in crosswalk:
                mapping = crosswalk[pleiades_id]
                qid = mapping['qid'] if isinstance(mapping, dict) else mapping
                entity['qid'] = qid
                updated += 1

                # Also update cross-reference
                if cr_prefix:
                    cr_key = f"{cr_prefix}:{entity['id']}"
                    if cr_key in crossref:
                        if not crossref[cr_key].get('qid'):
                            crossref[cr_key]['qid'] = qid
                            total_cr_updated += 1

        if updated:
            with open(filepath, 'w') as f:
                json.dump(entities, f, separators=(',', ':'))
            print(f"  {filename}: +{updated} QIDs")
            total_updated += updated

    if total_cr_updated:
        with open(CROSSREF_PATH, 'w') as f:
            json.dump(crossref, f, separators=(',', ':'))

    print(f"\nTotal: +{total_updated} entity QIDs, +{total_cr_updated} cross-ref QIDs")

if __name__ == '__main__':
    main()
