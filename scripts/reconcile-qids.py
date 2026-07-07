#!/usr/bin/env python3
"""
Reconcile entities with Wikidata QIDs using the wbsearchentities API.
More reliable than SPARQL during outages. Works for any entity type.

Usage:
  python scripts/reconcile-qids.py battles
  python scripts/reconcile-qids.py religious-sites
  python scripts/reconcile-qids.py ports
"""

import json
import sys
import time
import urllib.request
import urllib.parse
from math import radians, sin, cos, sqrt, atan2

UNIFIED_DIR = "src/data/unified"
CROSSREF_PATH = "src/data/wiki/cross-reference.json"
API_URL = "https://www.wikidata.org/w/api.php"

ENTITY_CONFIGS = {
    "battles": {
        "file": "battle.json",
        "cr_prefix": "battle",
        "wikidata_type": "Q178561",  # battle
        "name_key": "name",
    },
    "religious-sites": {
        "file": "religious-site.json",
        "cr_prefix": "religion",
        "wikidata_type": "Q16970",  # church building / religious site
        "name_key": "name",
    },
    "ports": {
        "file": "port.json",
        "cr_prefix": "port",
        "wikidata_type": "Q44782",  # port
        "name_key": "name",
    },
    "shipwrecks": {
        "file": "shipwreck.json",
        "cr_prefix": "shipwreck",
        "wikidata_type": "Q852190",  # shipwreck
        "name_key": "name",
    },
    "presses": {
        "file": "press.json",
        "cr_prefix": "press",
        "wikidata_type": None,
        "name_key": "name",
    },
}

def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))

def search_wikidata(query, language="en", limit=5):
    """Search Wikidata using wbsearchentities API."""
    params = {
        "action": "wbsearchentities",
        "search": query,
        "language": language,
        "limit": str(limit),
        "format": "json",
    }
    url = f"{API_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "AncientRomeAtlas/1.0 (nsoulfield@gmail.com)",
    })
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())

def get_entity_details(qid):
    """Get coordinates and image for a Wikidata entity."""
    params = {
        "action": "wbgetentities",
        "ids": qid,
        "props": "claims|descriptions",
        "languages": "en",
        "format": "json",
    }
    url = f"{API_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "AncientRomeAtlas/1.0 (nsoulfield@gmail.com)",
    })
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode())

    entity = data.get("entities", {}).get(qid, {})
    claims = entity.get("claims", {})

    result = {"qid": qid}

    # P625 = coordinate location
    coord_claims = claims.get("P625", [])
    if coord_claims:
        val = coord_claims[0].get("mainsnak", {}).get("datavalue", {}).get("value", {})
        result["lat"] = val.get("latitude")
        result["lng"] = val.get("longitude")

    # P18 = image
    img_claims = claims.get("P18", [])
    if img_claims:
        filename = img_claims[0].get("mainsnak", {}).get("datavalue", {}).get("value", "")
        if filename:
            result["imageUrl"] = f"https://commons.wikimedia.org/wiki/Special:FilePath/{urllib.parse.quote(filename)}"

    # Description
    descs = entity.get("descriptions", {})
    if "en" in descs:
        result["description"] = descs["en"]["value"]

    return result

def reconcile_entity(entity, config):
    """Try to match an entity to a Wikidata item."""
    name = entity.get(config["name_key"], "")
    if not name or len(name) < 3:
        return None

    try:
        results = search_wikidata(name)
    except Exception as e:
        print(f"  API error for '{name}': {e}")
        return None

    search_results = results.get("search", [])
    if not search_results:
        return None

    our_lat = entity.get("lat", 0)
    our_lng = entity.get("lng", 0)

    for sr in search_results:
        qid = sr["id"]
        label = sr.get("label", "")
        desc = sr.get("description", "")

        # Quick name check — at least some word overlap
        our_words = set(name.lower().split())
        wd_words = set(label.lower().split())
        overlap = len(our_words & wd_words)
        if overlap < 1:
            continue

        # Get coordinates to verify spatial proximity
        try:
            details = get_entity_details(qid)
        except Exception:
            continue

        wd_lat = details.get("lat")
        wd_lng = details.get("lng")

        if wd_lat is not None and wd_lng is not None and our_lat != 0 and our_lng != 0:
            dist = haversine(our_lat, our_lng, wd_lat, wd_lng)
            if dist > 50:  # more than 50km away — likely wrong match
                continue

        return {
            "qid": qid,
            "label": label,
            "description": details.get("description", desc),
            "imageUrl": details.get("imageUrl"),
            "dist_km": dist if (wd_lat is not None and our_lat != 0) else None,
        }

    return None

def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <entity-type>")
        print(f"Types: {', '.join(ENTITY_CONFIGS.keys())}")
        sys.exit(1)

    entity_type = sys.argv[1]
    if entity_type not in ENTITY_CONFIGS:
        print(f"Unknown type: {entity_type}")
        print(f"Available: {', '.join(ENTITY_CONFIGS.keys())}")
        sys.exit(1)

    config = ENTITY_CONFIGS[entity_type]
    data_path = f"{UNIFIED_DIR}/{config['file']}"

    entities = json.load(open(data_path))
    crossref = json.load(open(CROSSREF_PATH))

    # Only process entities without QIDs
    to_process = [e for e in entities if not e.get("qid")]
    print(f"Processing {len(to_process)} entities without QIDs (of {len(entities)} total)")

    matched = 0
    cr_added = 0
    cr_updated = 0

    for i, entity in enumerate(to_process):
        name = entity.get(config["name_key"], "")
        cr_key = f"{config['cr_prefix']}:{entity['id']}"

        # Skip if already has a QID in cross-ref
        if crossref.get(cr_key, {}).get("qid"):
            continue

        match = reconcile_entity(entity, config)
        if match:
            # Update unified data
            entity["qid"] = match["qid"]
            matched += 1

            # Update cross-reference
            cr_entry = crossref.get(cr_key, {})
            cr_entry["qid"] = match["qid"]
            cr_entry["label"] = match["label"]
            if match.get("description"):
                cr_entry["description"] = match["description"]
            if match.get("imageUrl") and not cr_entry.get("imageUrl"):
                cr_entry["imageUrl"] = match["imageUrl"]
            crossref[cr_key] = cr_entry

            if cr_key in crossref:
                cr_updated += 1
            else:
                cr_added += 1

            dist_str = f" ({match['dist_km']:.0f}km)" if match.get("dist_km") is not None else ""
            print(f"  [{matched}] {name} -> {match['qid']} {match['label']}{dist_str}")

        # Rate limit: ~2 req/sec (search + details = 2 calls per entity)
        if (i + 1) % 20 == 0:
            print(f"  ... processed {i+1}/{len(to_process)}, {matched} matched")
            time.sleep(1)

        # Save progress every 50 matches
        if matched > 0 and matched % 50 == 0:
            with open(data_path, "w") as f:
                json.dump(entities, f, separators=(",", ":"))
            with open(CROSSREF_PATH, "w") as f:
                json.dump(crossref, f, separators=(",", ":"))
            print(f"  [saved progress: {matched} matches]")

        time.sleep(0.5)  # be nice to Wikidata

    # Final save
    with open(data_path, "w") as f:
        json.dump(entities, f, separators=(",", ":"))
    with open(CROSSREF_PATH, "w") as f:
        json.dump(crossref, f, separators=(",", ":"))

    print(f"\nDone! Matched {matched}/{len(to_process)} entities")
    print(f"Cross-ref: {cr_added} added, {cr_updated} updated")

if __name__ == "__main__":
    main()
