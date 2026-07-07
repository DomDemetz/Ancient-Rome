#!/usr/bin/env python3
"""
Fetch English Wikipedia URLs for places that have Wikidata QIDs
but no Wikipedia URL in the knowledge store. Uses the Wikidata API
sitelinks endpoint.
"""

import json
import sys
import time
import urllib.parse
import urllib.request

KNOWLEDGE_PLACES = "src/data/knowledge/places.json"
BATCH_SIZE = 50  # Wikidata wbgetentities allows up to 50 per request


def fetch_wiki_urls_batch(qids):
    """Fetch English Wikipedia URLs for a batch of QIDs."""
    qids_str = '|'.join(qids)
    url = (
        f"https://www.wikidata.org/w/api.php?action=wbgetentities"
        f"&ids={qids_str}&props=sitelinks/urls&sitefilter=enwiki"
        f"&format=json"
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
        sitelinks = entity.get('sitelinks', {})
        enwiki = sitelinks.get('enwiki', {})
        wiki_url = enwiki.get('url', '')
        if wiki_url:
            results[qid] = wiki_url
    return results


def main():
    dry_run = '--dry-run' in sys.argv

    places = json.load(open(KNOWLEDGE_PLACES))

    # Find places with QID but no Wikipedia URL
    need_wiki = {}
    for place_id, entry in places.items():
        qid = entry.get('qid', '')
        if qid and not entry.get('wikipediaUrl'):
            need_wiki[place_id] = qid

    print(f"Places needing Wikipedia URLs: {len(need_wiki)}")

    if not need_wiki:
        print("Nothing to do!")
        return

    # Build QID -> place_id mapping
    qid_to_places = {}
    for pid, qid in need_wiki.items():
        qid_to_places.setdefault(qid, []).append(pid)

    unique_qids = list(qid_to_places.keys())
    print(f"Unique QIDs to query: {len(unique_qids)}")

    found = 0
    for i in range(0, len(unique_qids), BATCH_SIZE):
        batch = unique_qids[i:i+BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total = (len(unique_qids) - 1) // BATCH_SIZE + 1
        print(f"  Batch {batch_num}/{total}...", end='', flush=True)

        results = fetch_wiki_urls_batch(batch)
        batch_found = 0

        for qid, url in results.items():
            for pid in qid_to_places.get(qid, []):
                if not dry_run:
                    places[pid]['wikipediaUrl'] = url
                batch_found += 1
                found += 1

        print(f" {batch_found} URLs")
        time.sleep(0.5)

    print(f"\nTotal: {found} Wikipedia URLs found")

    if not dry_run and found > 0:
        with open(KNOWLEDGE_PLACES, 'w') as f:
            json.dump(places, f, separators=(',', ':'))
        print(f"Updated {KNOWLEDGE_PLACES}")
    elif dry_run:
        print("(dry run)")


if __name__ == "__main__":
    main()
