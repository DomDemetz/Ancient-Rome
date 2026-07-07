#!/usr/bin/env python3
"""
Fetch descriptions and Wikipedia URLs from Wikidata for cross-reference entries
that have QIDs but are missing descriptions or wikiUrl.
Uses the Wikidata API in batches of 50.
"""

import json
import sys
import time
import urllib.parse
import urllib.request

CROSSREF_PATH = "src/data/wiki/cross-reference.json"
BATCH_SIZE = 50

def fetch_enrichment_batch(qids):
    """Fetch descriptions and sitelinks for a batch of QIDs."""
    ids = '|'.join(qids)
    url = (f"https://www.wikidata.org/w/api.php?action=wbgetentities"
           f"&ids={ids}&props=descriptions|sitelinks&languages=en&format=json")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'AncientRomeAtlas/1.0'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        print(f"  API error: {e}")
        return {}

    results = {}
    for qid, entity in data.get('entities', {}).items():
        desc = entity.get('descriptions', {}).get('en', {}).get('value', '')
        wiki_title = entity.get('sitelinks', {}).get('enwiki', {}).get('title', '')
        wiki_url = ''
        if wiki_title:
            wiki_url = f"https://en.wikipedia.org/wiki/{urllib.parse.quote(wiki_title.replace(' ', '_'))}"
        results[qid] = {'description': desc, 'wikiUrl': wiki_url}
    return results


def main():
    dry_run = '--dry-run' in sys.argv

    crossref = json.load(open(CROSSREF_PATH))

    needs_enrichment = {}
    for eid, entry in crossref.items():
        qid = entry.get('qid')
        if not qid:
            continue
        missing_desc = not entry.get('description')
        missing_wiki = not entry.get('wikiUrl')
        if missing_desc or missing_wiki:
            needs_enrichment[eid] = qid

    print(f"Entries needing enrichment: {len(needs_enrichment)}")

    if not needs_enrichment:
        print("Nothing to do!")
        return

    qid_to_eids = {}
    for eid, qid in needs_enrichment.items():
        qid_to_eids.setdefault(qid, []).append(eid)

    unique_qids = list(qid_to_eids.keys())
    print(f"Unique QIDs to query: {len(unique_qids)}")

    descs_added = 0
    wikis_added = 0

    for i in range(0, len(unique_qids), BATCH_SIZE):
        batch = unique_qids[i:i+BATCH_SIZE]
        batch_num = i//BATCH_SIZE + 1
        total_batches = (len(unique_qids)-1)//BATCH_SIZE + 1
        print(f"  Batch {batch_num}/{total_batches}...", end='', flush=True)

        enrichments = fetch_enrichment_batch(batch)

        for qid, data in enrichments.items():
            for eid in qid_to_eids.get(qid, []):
                entry = crossref[eid]
                if data['description'] and not entry.get('description'):
                    if not dry_run:
                        entry['description'] = data['description']
                    descs_added += 1
                if data['wikiUrl'] and not entry.get('wikiUrl'):
                    if not dry_run:
                        entry['wikiUrl'] = data['wikiUrl']
                    wikis_added += 1

        print(f" done")
        time.sleep(0.5)

    print(f"\nDescriptions added: {descs_added}")
    print(f"Wikipedia URLs added: {wikis_added}")

    if not dry_run and (descs_added > 0 or wikis_added > 0):
        with open(CROSSREF_PATH, 'w') as f:
            json.dump(crossref, f, separators=(',', ':'))
        print(f"Updated {CROSSREF_PATH}")
    elif dry_run:
        print("(dry run — no files changed)")


if __name__ == "__main__":
    main()
