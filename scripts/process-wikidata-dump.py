#!/usr/bin/env python3
"""
Stream-process the Wikidata JSON dump (bz2 compressed, ~100GB).
Extract entities with coordinates (P625) into a local spatial index.
No need to decompress the full file — reads line by line.

Output: src/data/downloads/wikidata-geo-index.json
Format: { "Q123": { "label": "...", "lat": 41.9, "lng": 12.5, "desc": "...", "img": "...", "types": ["Q178561"] } }

Usage:
  python scripts/process-wikidata-dump.py
  # Takes ~4-6 hours depending on CPU (bz2 decompression is CPU-bound)
  # Output: ~50-100MB index of all geolocated entities
"""

import bz2
import json
import os
import sys
import time

DUMP_PATH = "src/data/downloads/wikidata-latest-all.json.bz2"
OUTPUT_PATH = "src/data/downloads/wikidata-geo-index.json"
PROGRESS_PATH = "src/data/downloads/wikidata-progress.json"

# Types we care about for matching against our entities
INTERESTING_TYPES = {
    'Q178561',   # battle
    'Q839954',   # archaeological site
    'Q16970',    # church building
    'Q44782',    # port
    'Q852190',   # shipwreck
    'Q12518',    # tower
    'Q34627',    # bridge
    'Q12280',    # bridge (older)
    'Q24354',    # theater (building)
    'Q57821',    # fortification
    'Q751876',   # château
    'Q15893266', # former entity
    'Q41176',    # building
    'Q35112',    # monument
    'Q4989906',  # monument
    'Q1081138',  # aqueduct
    'Q34763',    # temple
    'Q5107',     # continent (for filtering)
    'Q6256',     # country (for filtering)
    'Q515',      # city
    'Q7930989',  # city/town
    'Q3947',     # house
    'Q23413',    # castle
    'Q11303',    # amphitheater
    'Q162875',   # basilica
    'Q83405',    # factory
    'Q131681',   # tomb
    'Q381885',   # memorial
    'Q811979',   # architectural structure
    'Q570116',   # tourist attraction
    'Q33506',    # museum
    'Q2977',     # cathedral
    'Q1370598',  # triumphal arch
    'Q174782',   # square (urban)
    'Q55488',    # railway station
}

def extract_entity(line):
    """Parse a single Wikidata entity JSON line and extract relevant fields."""
    line = line.strip().rstrip(',')
    if not line or line in ('[\n', ']\n', '[', ']'):
        return None

    try:
        entity = json.loads(line)
    except json.JSONDecodeError:
        return None

    if entity.get('type') != 'item':
        return None

    qid = entity.get('id', '')
    if not qid.startswith('Q'):
        return None

    claims = entity.get('claims', {})

    # Must have coordinates (P625)
    coord_claims = claims.get('P625', [])
    if not coord_claims:
        return None

    # Extract coordinates
    try:
        val = coord_claims[0]['mainsnak']['datavalue']['value']
        lat = val['latitude']
        lng = val['longitude']
    except (KeyError, IndexError, TypeError):
        return None

    # Extract label (English preferred)
    labels = entity.get('labels', {})
    label = ''
    if 'en' in labels:
        label = labels['en'].get('value', '')
    elif labels:
        label = next(iter(labels.values()), {}).get('value', '')

    # Extract description
    descs = entity.get('descriptions', {})
    desc = descs.get('en', {}).get('value', '')

    # Extract image (P18)
    img = ''
    img_claims = claims.get('P18', [])
    if img_claims:
        try:
            img = img_claims[0]['mainsnak']['datavalue']['value']
        except (KeyError, IndexError, TypeError):
            pass

    # Extract instance-of types (P31)
    types = []
    type_claims = claims.get('P31', [])
    for tc in type_claims:
        try:
            type_qid = tc['mainsnak']['datavalue']['value']['id']
            types.append(type_qid)
        except (KeyError, TypeError):
            pass

    result = {
        'label': label,
        'lat': round(lat, 5),
        'lng': round(lng, 5),
    }
    if desc:
        result['desc'] = desc
    if img:
        result['img'] = img
    if types:
        result['types'] = types

    return qid, result

def main():
    if not os.path.exists(DUMP_PATH):
        print(f"Dump not found: {DUMP_PATH}")
        print("Download with: curl -L https://dumps.wikimedia.org/wikidatawiki/entities/latest-all.json.bz2 -o " + DUMP_PATH)
        sys.exit(1)

    file_size = os.path.getsize(DUMP_PATH)
    print(f"Processing {DUMP_PATH} ({file_size / 1e9:.1f} GB)")

    # Load progress if resuming
    geo_index = {}
    start_byte = 0
    if os.path.exists(PROGRESS_PATH):
        progress = json.load(open(PROGRESS_PATH))
        start_byte = progress.get('bytes_read', 0)
        if os.path.exists(OUTPUT_PATH):
            geo_index = json.load(open(OUTPUT_PATH))
        print(f"Resuming from byte {start_byte / 1e9:.2f} GB, {len(geo_index)} entities loaded")

    start_time = time.time()
    lines_processed = 0
    entities_found = 0
    bytes_read = 0

    with bz2.open(DUMP_PATH, 'rt', encoding='utf-8') as f:
        for line in f:
            bytes_read += len(line.encode('utf-8'))
            lines_processed += 1

            result = extract_entity(line)
            if result:
                qid, data = result
                geo_index[qid] = data
                entities_found += 1

            # Progress report every 100K lines
            if lines_processed % 100000 == 0:
                elapsed = time.time() - start_time
                rate = lines_processed / elapsed if elapsed > 0 else 0
                # bz2 doesn't give us compressed byte position easily,
                # so estimate based on typical compression ratio (~10:1)
                print(f"  {lines_processed/1e6:.1f}M lines, "
                      f"{entities_found} geolocated, "
                      f"{rate:.0f} lines/sec, "
                      f"{elapsed/60:.1f} min elapsed")

            # Save progress every 1M lines
            if lines_processed % 1000000 == 0:
                with open(OUTPUT_PATH, 'w') as out:
                    json.dump(geo_index, out, separators=(',', ':'))
                with open(PROGRESS_PATH, 'w') as pf:
                    json.dump({'bytes_read': bytes_read, 'lines': lines_processed}, pf)
                print(f"  [saved: {len(geo_index)} entities]")

    # Final save
    with open(OUTPUT_PATH, 'w') as out:
        json.dump(geo_index, out, separators=(',', ':'))

    # Clean up progress file
    if os.path.exists(PROGRESS_PATH):
        os.remove(PROGRESS_PATH)

    elapsed = time.time() - start_time
    print(f"\nDone! Processed {lines_processed/1e6:.1f}M lines in {elapsed/60:.1f} minutes")
    print(f"Found {len(geo_index)} geolocated entities")
    print(f"Index size: {os.path.getsize(OUTPUT_PATH) / 1e6:.1f} MB")
    print(f"Saved to {OUTPUT_PATH}")

if __name__ == '__main__':
    main()
