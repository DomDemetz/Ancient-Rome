#!/usr/bin/env python3
"""
Fast stream-processor for the Wikidata JSON dump.
Handles partial (still-downloading) bz2 files gracefully.
Reports progress every 10 seconds instead of every 100K lines.

Output: src/data/downloads/wikidata-geo-index.json
"""

import bz2
import json
import os
import sys
import time
import signal

DUMP_PATH = "src/data/downloads/wikidata-latest-all.json.bz2"
OUTPUT_PATH = "src/data/downloads/wikidata-geo-index.json"

geo_index = {}
lines_processed = 0
entities_found = 0
start_time = time.time()
last_report = start_time

def save_and_exit(signum=None, frame=None):
    elapsed = time.time() - start_time
    print(f"\nSaving {len(geo_index)} entities after {elapsed/60:.1f} min...")
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(geo_index, f, separators=(',', ':'))
    print(f"Saved to {OUTPUT_PATH} ({os.path.getsize(OUTPUT_PATH) / 1e6:.1f} MB)")
    if signum is not None:
        sys.exit(0)

signal.signal(signal.SIGINT, save_and_exit)
signal.signal(signal.SIGTERM, save_and_exit)

def extract_geo(line):
    line = line.strip().rstrip(',')
    if not line or line in ('[', ']'):
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

    coord_claims = claims.get('P625', [])
    if not coord_claims:
        return None

    try:
        val = coord_claims[0]['mainsnak']['datavalue']['value']
        lat = val['latitude']
        lng = val['longitude']
    except (KeyError, IndexError, TypeError):
        return None

    labels = entity.get('labels', {})
    label = ''
    if 'en' in labels:
        label = labels['en'].get('value', '')
    elif labels:
        label = next(iter(labels.values()), {}).get('value', '')

    descs = entity.get('descriptions', {})
    desc = descs.get('en', {}).get('value', '')

    img = ''
    img_claims = claims.get('P18', [])
    if img_claims:
        try:
            img = img_claims[0]['mainsnak']['datavalue']['value']
        except (KeyError, IndexError, TypeError):
            pass

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


if not os.path.exists(DUMP_PATH):
    print(f"Dump not found: {DUMP_PATH}")
    sys.exit(1)

file_size = os.path.getsize(DUMP_PATH)
print(f"Processing {DUMP_PATH} ({file_size / 1e9:.1f} GB)", flush=True)

if os.path.exists(OUTPUT_PATH):
    geo_index = json.load(open(OUTPUT_PATH))
    print(f"Loaded existing index: {len(geo_index)} entities", flush=True)

try:
    with bz2.open(DUMP_PATH, 'rt', encoding='utf-8') as f:
        for line in f:
            lines_processed += 1

            result = extract_geo(line)
            if result:
                qid, data = result
                geo_index[qid] = data
                entities_found += 1

            now = time.time()
            if now - last_report >= 10:
                elapsed = now - start_time
                rate = lines_processed / elapsed if elapsed > 0 else 0
                print(f"  {lines_processed/1e6:.2f}M lines | "
                      f"{entities_found:,} geolocated | "
                      f"{rate:.0f} lines/sec | "
                      f"{elapsed/60:.1f} min | "
                      f"last QID: {qid if result else '—'}",
                      flush=True)
                last_report = now

            if lines_processed % 1_000_000 == 0:
                save_and_exit()
                print(f"  [checkpoint saved]", flush=True)

except EOFError:
    print(f"\nHit end of partial file (expected for in-progress download)", flush=True)
except Exception as e:
    print(f"\nError at line {lines_processed}: {e}", flush=True)

save_and_exit()
elapsed = time.time() - start_time
print(f"Done! {lines_processed/1e6:.1f}M lines in {elapsed/60:.1f} min")
print(f"Found {entities_found:,} geolocated entities")
