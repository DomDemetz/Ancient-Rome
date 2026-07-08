#!/usr/bin/env python3
"""
Fetch Wikipedia extracts and thumbnails for cross-reference entities
that have QIDs and Wikipedia URLs but no extract yet.

Writes directly to knowledge/features.json.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

CROSSREF_PATH = "src/data/wiki/cross-reference.json"
KNOWLEDGE_FEATURES_PATH = "src/data/knowledge/features.json"
BATCH_SIZE = 20  # Wikipedia API allows up to 20 titles per request


def fetch_extracts_batch(titles, max_retries=3):
    """Fetch extracts + thumbnails from Wikipedia for a batch of page titles."""
    titles_str = '|'.join(titles)
    url = (
        f"https://en.wikipedia.org/w/api.php?action=query"
        f"&titles={urllib.parse.quote(titles_str)}"
        f"&prop=extracts|pageimages&exintro=1&explaintext=1"
        f"&pithumbsize=300&format=json&redirects=1"
    )
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'AncientRomeAtlas/1.0'})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())
            break
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < max_retries - 1:
                wait = 5 * (attempt + 1)
                print(f" [429, waiting {wait}s]", end='', flush=True)
                time.sleep(wait)
                continue
            print(f"  API error: {e}")
            return {}
        except Exception as e:
            print(f"  API error: {e}")
            return {}

    results = {}
    redirects = {}
    for r in data.get('query', {}).get('redirects', []):
        redirects[r['to']] = r['from']

    for page_id, page in data.get('query', {}).get('pages', {}).items():
        if int(page_id) < 0:
            continue
        title = page.get('title', '')
        original_title = redirects.get(title, title)
        extract = page.get('extract', '')
        thumbnail = page.get('thumbnail', {}).get('source', '')

        if extract:
            if len(extract) > 500:
                extract = extract[:497] + '...'
            results[original_title] = {
                'extract': extract,
                'thumbnail': thumbnail if thumbnail else None,
            }

    return results


def main():
    dry_run = '--dry-run' in sys.argv

    crossref = json.load(open(CROSSREF_PATH))
    knowledge = {}
    if os.path.exists(KNOWLEDGE_FEATURES_PATH):
        knowledge = json.load(open(KNOWLEDGE_FEATURES_PATH))

    # Find entities with wikiUrl but no extract in knowledge
    needs_extract = {}
    for eid, entry in crossref.items():
        wiki_url = entry.get('wikiUrl', '')
        if not wiki_url:
            continue
        # Check if knowledge already has an extract for this entity
        if eid in knowledge and knowledge[eid].get('extract'):
            continue
        # Extract page title from URL
        try:
            path = urllib.parse.urlparse(wiki_url).path
            title = urllib.parse.unquote(path.split('/wiki/')[-1]).replace('_', ' ')
            if title:
                needs_extract[eid] = title
        except Exception:
            continue

    print(f"Entities needing extracts: {len(needs_extract)}")

    if not needs_extract:
        print("Nothing to do!")
        return

    # Batch fetch
    items = list(needs_extract.items())
    fetched = 0
    failed = 0

    for i in range(0, len(items), BATCH_SIZE):
        batch_items = items[i:i+BATCH_SIZE]
        titles = [title for _, title in batch_items]
        eid_map = {title: eid for eid, title in batch_items}

        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(items) - 1) // BATCH_SIZE + 1
        print(f"  Batch {batch_num}/{total_batches}...", end='', flush=True)

        results = fetch_extracts_batch(titles)

        batch_fetched = 0
        for title in titles:
            eid = eid_map[title]
            if title in results:
                if not dry_run:
                    if eid not in knowledge:
                        knowledge[eid] = {}
                    knowledge[eid]['extract'] = results[title]['extract']
                    if results[title].get('thumbnail'):
                        knowledge[eid]['thumbnail'] = results[title]['thumbnail']
                    knowledge[eid]['sources'] = knowledge[eid].get('sources', [])
                    if 'wiki-extract-fetch' not in knowledge[eid]['sources']:
                        knowledge[eid]['sources'].append('wiki-extract-fetch')
                batch_fetched += 1
                fetched += 1

        print(f" {batch_fetched} extracts")
        if not dry_run and fetched > 0 and batch_num % 20 == 0:
            with open(KNOWLEDGE_FEATURES_PATH, 'w') as f:
                json.dump(knowledge, f, separators=(',', ':'))
            print(f"    (checkpoint: {fetched} extracts saved)")
        time.sleep(0.5)

    print(f"\nTotal: {fetched} extracts fetched, {failed} failed")

    if not dry_run and fetched > 0:
        with open(KNOWLEDGE_FEATURES_PATH, 'w') as f:
            json.dump(knowledge, f, separators=(',', ':'))
        print(f"Updated {KNOWLEDGE_FEATURES_PATH}")
    elif dry_run:
        print("(dry run)")


if __name__ == "__main__":
    main()
