#!/usr/bin/env python3
"""
Fetch images from Wikidata for cross-reference entities that have QIDs but no imageUrl.
Uses the Wikidata API in batches of 50 (max allowed).
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request

CROSSREF_PATH = "src/data/wiki/cross-reference.json"
BATCH_SIZE = 50

def fetch_images_batch(qids):
    """Fetch P18 image claims for a batch of QIDs."""
    ids = '|'.join(qids)
    url = f"https://www.wikidata.org/w/api.php?action=wbgetentities&ids={ids}&props=claims&format=json"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'AncientRomeAtlas/1.0'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        print(f"  API error: {e}")
        return {}

    results = {}
    for qid, entity in data.get('entities', {}).items():
        claims = entity.get('claims', {})
        img_claims = claims.get('P18', [])
        if img_claims:
            try:
                filename = img_claims[0]['mainsnak']['datavalue']['value']
                results[qid] = f"https://commons.wikimedia.org/wiki/Special:FilePath/{urllib.parse.quote(filename)}"
            except (KeyError, IndexError):
                pass
    return results


def main():
    dry_run = '--dry-run' in sys.argv

    crossref = json.load(open(CROSSREF_PATH))

    needs_image = {}
    for eid, entry in crossref.items():
        qid = entry.get('qid')
        if qid and not entry.get('imageUrl'):
            needs_image[eid] = qid

    print(f"Entities with QID but no image: {len(needs_image)}")

    if not needs_image:
        print("Nothing to do!")
        return

    qid_to_eids = {}
    for eid, qid in needs_image.items():
        qid_to_eids.setdefault(qid, []).append(eid)

    unique_qids = list(qid_to_eids.keys())
    print(f"Unique QIDs to check: {len(unique_qids)}")

    found = 0
    for i in range(0, len(unique_qids), BATCH_SIZE):
        batch = unique_qids[i:i+BATCH_SIZE]
        print(f"  Batch {i//BATCH_SIZE + 1}/{(len(unique_qids)-1)//BATCH_SIZE + 1} ({len(batch)} QIDs)...", end='', flush=True)

        images = fetch_images_batch(batch)
        batch_found = 0

        for qid, img_url in images.items():
            for eid in qid_to_eids.get(qid, []):
                if not dry_run:
                    crossref[eid]['imageUrl'] = img_url
                batch_found += 1
                found += 1

        print(f" {batch_found} images found")
        time.sleep(1)

    print(f"\nTotal images found: {found}/{len(needs_image)}")

    if not dry_run and found > 0:
        with open(CROSSREF_PATH, 'w') as f:
            json.dump(crossref, f, separators=(',', ':'))
        print(f"Updated {CROSSREF_PATH}")
    elif dry_run:
        print("(dry run — no files changed)")


if __name__ == "__main__":
    main()
