#!/usr/bin/env python3
"""Match battles in our dataset to Wikidata QIDs via SPARQL + fuzzy matching."""

import json
import re
import time
import urllib.request
import urllib.parse
from math import radians, sin, cos, sqrt, atan2

BATTLES_PATH = "src/data/unified/battle.json"
CROSSREF_PATH = "src/data/wiki/cross-reference.json"

SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"

SPARQL_QUERY = """
SELECT ?battle ?battleLabel ?coord ?date ?image ?desc WHERE {
  ?battle wdt:P31/wdt:P279* wd:Q178561 .  # instance of battle (or subclass)
  ?battle wdt:P625 ?coord .                # has coordinates
  OPTIONAL { ?battle wdt:P585 ?date . }    # point in time
  OPTIONAL { ?battle wdt:P18 ?image . }    # image
  OPTIONAL { ?battle schema:description ?desc . FILTER(LANG(?desc) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
"""

def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))

def normalize_name(name):
    name = name.lower()
    name = re.sub(r'\bbattle of (the )?\b', '', name)
    name = re.sub(r'\(.*?\)', '', name)
    name = re.sub(r'[^a-z0-9 ]', '', name)
    return name.strip()

def query_wikidata():
    params = urllib.parse.urlencode({
        'query': SPARQL_QUERY,
        'format': 'json'
    })
    url = f"{SPARQL_ENDPOINT}?{params}"
    req = urllib.request.Request(url, headers={
        'User-Agent': 'AncientRomeAtlas/1.0 (nsoulfield@gmail.com)',
        'Accept': 'application/json',
    })
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())

def parse_coord(coord_str):
    m = re.match(r'Point\(([-\d.]+) ([-\d.]+)\)', coord_str)
    if m:
        return float(m.group(2)), float(m.group(1))  # lat, lng
    return None, None

def main():
    print("Querying Wikidata for battles...")
    result = query_wikidata()
    bindings = result['results']['bindings']
    print(f"Got {len(bindings)} battle entries from Wikidata")

    wd_battles = []
    for b in bindings:
        qid = b['battle']['value'].split('/')[-1]
        name = b.get('battleLabel', {}).get('value', '')
        coord = b.get('coord', {}).get('value', '')
        lat, lng = parse_coord(coord)
        image = b.get('image', {}).get('value', '')
        desc = b.get('desc', {}).get('value', '')
        if lat is not None:
            wd_battles.append({
                'qid': qid, 'name': name, 'lat': lat, 'lng': lng,
                'image': image, 'desc': desc,
            })

    print(f"Parsed {len(wd_battles)} battles with coordinates")

    battles = json.load(open(BATTLES_PATH))
    print(f"Our dataset: {len(battles)} battles")

    matches = []
    unmatched = []

    for our in battles:
        our_name = normalize_name(our['name'])
        our_lat, our_lng = our['lat'], our['lng']

        best = None
        best_score = 0

        for wd in wd_battles:
            wd_name = normalize_name(wd['name'])
            dist = haversine(our_lat, our_lng, wd['lat'], wd['lng'])

            # Name similarity (simple word overlap)
            our_words = set(our_name.split())
            wd_words = set(wd_name.split())
            if not our_words or not wd_words:
                continue
            overlap = len(our_words & wd_words)
            name_score = overlap / max(len(our_words), len(wd_words))

            # Score: high name match + close distance
            if name_score >= 0.5 and dist < 100:
                score = name_score * 10 + max(0, 100 - dist)
                if score > best_score:
                    best_score = score
                    best = wd

        if best:
            matches.append((our, best, best_score))
        else:
            unmatched.append(our)

    print(f"\nMatched: {len(matches)} / {len(battles)}")
    print(f"Unmatched: {len(unmatched)}")

    # Show top matches
    matches.sort(key=lambda x: -x[2])
    print("\n=== TOP MATCHES ===")
    for our, wd, score in matches[:30]:
        has_img = "IMG" if wd['image'] else "   "
        print(f"  {has_img} {our['name']:<45} -> {wd['qid']} {wd['name']:<45} (score={score:.1f})")

    # Apply QIDs to battle data
    updated = 0
    for our, wd, score in matches:
        if score >= 5:  # reasonable threshold
            our['qid'] = wd['qid']
            updated += 1

    print(f"\nApplied {updated} QIDs to battle data")

    with open(BATTLES_PATH, 'w') as f:
        json.dump(battles, f, separators=(',', ':'))
    print(f"Wrote {BATTLES_PATH}")

    # Build cross-reference entries for matched battles
    crossref = json.load(open(CROSSREF_PATH))
    added = 0
    for our, wd, score in matches:
        if score < 5:
            continue
        cr_key = f"battle:{our['id']}"
        if cr_key not in crossref:
            entry = {
                'label': wd['name'],
                'qid': wd['qid'],
            }
            if wd['desc']:
                entry['description'] = wd['desc']
            if wd['image']:
                entry['imageUrl'] = wd['image']
            crossref[cr_key] = entry
            added += 1

    print(f"Added {added} new cross-reference entries")
    with open(CROSSREF_PATH, 'w') as f:
        json.dump(crossref, f, separators=(',', ':'))
    print(f"Wrote {CROSSREF_PATH}")

if __name__ == '__main__':
    main()
