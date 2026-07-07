#!/usr/bin/env python3
"""
Backfill Wikipedia URLs for cross-reference entries that have QIDs
but no wikiUrl. Uses Wikidata sitelinks API.
"""

import json
import sys
import time
import urllib.request

CROSSREF_PATH = "src/data/wiki/cross-reference.json"
BATCH_SIZE = 50


def fetch_wiki_urls_batch(qids):
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
        wiki_url = entity.get('sitelinks', {}).get('enwiki', {}).get('url', '')
        if wiki_url:
            results[qid] = wiki_url
    return results


def main():
    dry_run = '--dry-run' in sys.argv
    cr = json.load(open(CROSSREF_PATH))

    qid_to_keys = {}
    for key, entry in cr.items():
        qid = entry.get('qid')
        if qid and not entry.get('wikiUrl'):
            qid_to_keys.setdefault(qid, []).append(key)

    unique_qids = list(qid_to_keys.keys())
    print(f"Cross-ref entries needing wiki URLs: {sum(len(v) for v in qid_to_keys.values())}")
    print(f"Unique QIDs to query: {len(unique_qids)}")

    if not unique_qids:
        print("Nothing to do!")
        return

    found = 0
    for i in range(0, len(unique_qids), BATCH_SIZE):
        batch = unique_qids[i:i+BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total = (len(unique_qids) - 1) // BATCH_SIZE + 1
        print(f"  Batch {batch_num}/{total}...", end='', flush=True)

        results = fetch_wiki_urls_batch(batch)
        batch_found = 0

        for qid, url in results.items():
            for key in qid_to_keys.get(qid, []):
                if not dry_run:
                    cr[key]['wikiUrl'] = url
                batch_found += 1
                found += 1

        print(f" {batch_found} URLs")
        time.sleep(0.5)

    print(f"\nTotal: {found} wiki URLs added")

    if not dry_run and found > 0:
        with open(CROSSREF_PATH, 'w') as f:
            json.dump(cr, f, separators=(',', ':'))
        print(f"Updated {CROSSREF_PATH}")
    elif dry_run:
        print("(dry run)")


if __name__ == "__main__":
    main()
