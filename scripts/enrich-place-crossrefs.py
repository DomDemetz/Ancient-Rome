#!/usr/bin/env python3
"""
Add cross-reference entries for places that have QIDs but no cross-ref.
Fetches Wikidata labels, descriptions, Wikipedia URLs, and P18 images.

After running, rebuild knowledge with: python scripts/build-knowledge.py
Then fetch extracts with: python scripts/fetch-place-extracts.py
"""

import json
import sys
import time
import urllib.parse
import urllib.request

PLACES_PATH = "src/data/places/places.json"
CROSSREF_PATH = "src/data/wiki/cross-reference.json"
BATCH_SIZE = 50


def fetch_wikidata_batch(qids):
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


def cr_key_for_place(p):
    """Determine the cross-reference key for a place."""
    if p.get('dare'):
        return f"settlement:{p['dare']['id']}"
    if p.get('pid'):
        return f"pleiades:{p['pid']}"
    if p['id'].startswith('wd-'):
        return p['id']
    return f"settlement:{p['id']}"


def main():
    dry_run = '--dry-run' in sys.argv

    places = json.load(open(PLACES_PATH))
    cr = json.load(open(CROSSREF_PATH))

    needs = []
    for p in places:
        qid = p.get('qid')
        if not qid:
            continue
        key = cr_key_for_place(p)
        if key not in cr:
            needs.append((p, key, qid))

    print(f"Places with QID but no cross-ref: {len(needs)}")

    if not needs:
        print("Nothing to do!")
        return

    # Deduplicate by QID
    qid_to_entries = {}
    for p, key, qid in needs:
        qid_to_entries.setdefault(qid, []).append((p, key))

    unique_qids = list(qid_to_entries.keys())
    print(f"Unique QIDs to query: {len(unique_qids)}")

    added = 0
    with_image = 0
    with_wiki = 0

    for i in range(0, len(unique_qids), BATCH_SIZE):
        batch = unique_qids[i:i+BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(unique_qids) - 1) // BATCH_SIZE + 1
        print(f"  Batch {batch_num}/{total_batches}...", end='', flush=True)

        results = fetch_wikidata_batch(batch)
        batch_added = 0

        for qid, data in results.items():
            for p, key in qid_to_entries.get(qid, []):
                if not dry_run:
                    entry = {'qid': qid}
                    if data['label']:
                        entry['label'] = data['label']
                    if data['description']:
                        entry['description'] = data['description']
                    if data['wikiUrl']:
                        entry['wikiUrl'] = data['wikiUrl']
                        with_wiki += 1
                    if data['imageUrl']:
                        entry['imageUrl'] = data['imageUrl']
                        with_image += 1
                    cr[key] = entry
                batch_added += 1
                added += 1

        print(f" {batch_added} entries")
        time.sleep(0.5)

    print(f"\nTotal: {added} cross-ref entries added")
    print(f"  with Wikipedia URL: {with_wiki}")
    print(f"  with image: {with_image}")

    if not dry_run and added > 0:
        with open(CROSSREF_PATH, 'w') as f:
            json.dump(cr, f, separators=(',', ':'))
        print(f"Updated {CROSSREF_PATH}")
    elif dry_run:
        print("(dry run)")


if __name__ == "__main__":
    main()
