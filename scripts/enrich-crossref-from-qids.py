#!/usr/bin/env python3
"""
Add cross-reference entries for unified entities that have QIDs
but no cross-reference entry. Fetches Wikidata labels, descriptions,
Wikipedia URLs, and P18 images.
"""

import json
import glob
import sys
import time
import urllib.parse
import urllib.request

CROSSREF_PATH = "src/data/wiki/cross-reference.json"
UNIFIED_DIR = "src/data/unified"
BATCH_SIZE = 50


def fetch_wikidata_batch(qids):
    """Fetch labels, descriptions, sitelinks, and P18 claims from Wikidata."""
    qids_str = '|'.join(qids)
    url = (
        f"https://www.wikidata.org/w/api.php?action=wbgetentities"
        f"&ids={qids_str}&props=labels|descriptions|claims|sitelinks/urls"
        f"&languages=en&sitefilter=enwiki&format=json"
    )
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'AncientRomeAtlas/1.0'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        print(f"  API error: {e}")
        return {}

    results = {}
    for qid, entity in data.get('entities', {}).items():
        if 'missing' in entity:
            continue

        label = entity.get('labels', {}).get('en', {}).get('value', '')
        desc = entity.get('descriptions', {}).get('en', {}).get('value', '')
        wiki_url = entity.get('sitelinks', {}).get('enwiki', {}).get('url', '')

        # P18 = image
        image_name = ''
        p18 = entity.get('claims', {}).get('P18', [])
        if p18:
            mainsnak = p18[0].get('mainsnak', {})
            image_name = mainsnak.get('datavalue', {}).get('value', '')

        image_url = ''
        if image_name:
            encoded = urllib.parse.quote(image_name.replace(' ', '_'))
            image_url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{encoded}?width=300"

        results[qid] = {
            'label': label,
            'description': desc,
            'wikiUrl': wiki_url,
            'imageUrl': image_url,
        }

    return results


def main():
    dry_run = '--dry-run' in sys.argv

    cr = json.load(open(CROSSREF_PATH))

    # Find entities with QIDs but no cross-reference entry
    needs_enrichment = []
    for fpath in sorted(glob.glob(f"{UNIFIED_DIR}/*.json")):
        data = json.load(open(fpath))
        for e in data:
            qid = e.get('qid')
            if qid and e['id'] not in cr:
                needs_enrichment.append((e['id'], qid))

    print(f"Entities needing cross-reference: {len(needs_enrichment)}")

    if not needs_enrichment:
        print("Nothing to do!")
        return

    # Group by QID to avoid duplicate fetches
    qid_to_entities = {}
    for eid, qid in needs_enrichment:
        qid_to_entities.setdefault(qid, []).append(eid)

    unique_qids = list(qid_to_entities.keys())
    print(f"Unique QIDs to query: {len(unique_qids)}")

    added = 0
    with_image = 0

    for i in range(0, len(unique_qids), BATCH_SIZE):
        batch = unique_qids[i:i+BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total = (len(unique_qids) - 1) // BATCH_SIZE + 1
        print(f"  Batch {batch_num}/{total}...", end='', flush=True)

        results = fetch_wikidata_batch(batch)
        batch_added = 0

        for qid, data in results.items():
            for eid in qid_to_entities.get(qid, []):
                if not dry_run:
                    entry = {'qid': qid}
                    if data['description']:
                        entry['description'] = data['description']
                    if data['wikiUrl']:
                        entry['wikiUrl'] = data['wikiUrl']
                    if data['imageUrl']:
                        entry['imageUrl'] = data['imageUrl']
                        with_image += 1
                    cr[eid] = entry
                batch_added += 1
                added += 1

        print(f" {batch_added} entries")
        time.sleep(0.5)

    print(f"\nTotal: {added} cross-ref entries added ({with_image} with images)")

    if not dry_run and added > 0:
        with open(CROSSREF_PATH, 'w') as f:
            json.dump(cr, f, separators=(',', ':'))
        print(f"Updated {CROSSREF_PATH}")
    elif dry_run:
        print("(dry run)")


if __name__ == "__main__":
    main()
