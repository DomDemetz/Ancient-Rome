#!/usr/bin/env python3
"""
Enrich cross-reference entries with images and descriptions from Wikidata.
Uses wbgetentities API (batch of 50 at a time) — more reliable than SPARQL.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.parse

UNIFIED_DIR = "src/data/unified"
CROSSREF_PATH = "src/data/wiki/cross-reference.json"
API_URL = "https://www.wikidata.org/w/api.php"

def batch_get_entities(qids):
    """Fetch up to 50 entities from Wikidata API."""
    params = {
        "action": "wbgetentities",
        "ids": "|".join(qids),
        "props": "claims|descriptions|labels",
        "languages": "en",
        "format": "json",
    }
    url = f"{API_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "AncientRomeAtlas/1.0 (nsoulfield@gmail.com)",
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())

def extract_image(claims):
    """Extract image filename from P18 claims."""
    img_claims = claims.get("P18", [])
    if img_claims:
        try:
            filename = img_claims[0]["mainsnak"]["datavalue"]["value"]
            return f"https://commons.wikimedia.org/wiki/Special:FilePath/{urllib.parse.quote(filename)}"
        except (KeyError, IndexError, TypeError):
            pass
    return None

def extract_description(entity):
    """Extract English description."""
    descs = entity.get("descriptions", {})
    return descs.get("en", {}).get("value", "")

def extract_label(entity):
    """Extract English label."""
    labels = entity.get("labels", {})
    return labels.get("en", {}).get("value", "")

def main():
    crossref = json.load(open(CROSSREF_PATH))

    # Collect all entities with QIDs but no images
    to_enrich = {}
    for f in sorted(os.listdir(UNIFIED_DIR)):
        if not f.endswith('.json'):
            continue
        data = json.load(open(os.path.join(UNIFIED_DIR, f)))
        for e in data:
            qid = e.get('qid')
            if not qid:
                continue
            cr_key = e['id']
            entry = crossref.get(cr_key, {})
            if not entry.get('imageUrl'):
                to_enrich[cr_key] = {
                    'qid': qid,
                    'name': e.get('name', ''),
                    'existing': entry,
                }

    print(f"Entities needing enrichment: {len(to_enrich)}")

    # Group by QID for batch fetching
    qid_to_keys = {}
    for cr_key, info in to_enrich.items():
        qid = info['qid']
        if qid not in qid_to_keys:
            qid_to_keys[qid] = []
        qid_to_keys[qid].append(cr_key)

    unique_qids = list(qid_to_keys.keys())
    print(f"Unique QIDs to fetch: {len(unique_qids)}")

    images_found = 0
    descs_found = 0
    batch_size = 50

    for i in range(0, len(unique_qids), batch_size):
        batch = unique_qids[i:i + batch_size]

        try:
            result = batch_get_entities(batch)
        except Exception as e:
            print(f"  API error at batch {i}: {e}")
            time.sleep(5)
            continue

        entities = result.get("entities", {})
        for qid in batch:
            entity = entities.get(qid, {})
            if not entity or entity.get("missing"):
                continue

            claims = entity.get("claims", {})
            image_url = extract_image(claims)
            description = extract_description(entity)
            label = extract_label(entity)

            for cr_key in qid_to_keys.get(qid, []):
                entry = crossref.get(cr_key, {})
                entry['qid'] = qid
                if label and not entry.get('label'):
                    entry['label'] = label
                if image_url:
                    entry['imageUrl'] = image_url
                    images_found += 1
                if description and not entry.get('description'):
                    entry['description'] = description
                    descs_found += 1
                crossref[cr_key] = entry

        batch_num = i // batch_size + 1
        total_batches = (len(unique_qids) + batch_size - 1) // batch_size
        if batch_num % 10 == 0 or batch_num == total_batches:
            print(f"  Batch {batch_num}/{total_batches}: "
                  f"{images_found} images, {descs_found} descriptions")

        # Save progress every 50 batches
        if batch_num % 50 == 0:
            with open(CROSSREF_PATH, 'w') as f:
                json.dump(crossref, f, separators=(',', ':'))
            print(f"  [saved progress]")

        time.sleep(0.5)  # rate limit: ~2 req/sec

    # Final save
    with open(CROSSREF_PATH, 'w') as f:
        json.dump(crossref, f, separators=(',', ':'))

    print(f"\nDone! Found {images_found} images, {descs_found} descriptions")
    print(f"Cross-ref entries: {len(crossref)}")

if __name__ == '__main__':
    main()
