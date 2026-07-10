#!/usr/bin/env python3
"""
Ingest world historical battles from Wikidata SPARQL.

Downloads all battles (P31=Q178561) with coordinates and dates,
outputting in a format compatible with the existing battles.json schema.

Usage: python3 scripts/ingest-wikidata-battles.py
"""
import json, os, re, time, urllib.request, urllib.parse

SPARQL_URL = "https://query.wikidata.org/sparql"
CACHE = "/tmp/wikidata-battles-raw.json"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "data", "battles", "wikidata-battles.json")

QUERY = """
SELECT ?battle ?battleLabel ?coord ?date ?date2 ?partOfLabel WHERE {
  ?battle wdt:P31/wdt:P279* wd:Q178561 .
  ?battle wdt:P625 ?coord .
  OPTIONAL { ?battle wdt:P585 ?date }
  OPTIONAL { ?battle wdt:P580 ?date2 }
  OPTIONAL { ?battle wdt:P361 ?partOf }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}
"""

USER_AGENT = "AncientRomeAtlas/1.0 (https://github.com/; research project)"


def fetch_sparql():
    """Fetch battles from Wikidata SPARQL, with caching."""
    if os.path.exists(CACHE):
        age_hours = (time.time() - os.path.getmtime(CACHE)) / 3600
        if age_hours < 24:
            print(f"Using cached results ({age_hours:.1f}h old)")
            with open(CACHE) as f:
                return json.load(f)

    print("Querying Wikidata SPARQL (this may take 30-60s)...")
    params = urllib.parse.urlencode({"query": QUERY, "format": "json"})
    req = urllib.request.Request(
        f"{SPARQL_URL}?{params}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )

    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            break
        except Exception as e:
            if attempt < 2:
                wait = 10 * (attempt + 1)
                print(f"  Retry {attempt+1} after error: {e} (waiting {wait}s)")
                time.sleep(wait)
            else:
                raise

    with open(CACHE, "w") as f:
        json.dump(data, f)
    print(f"  Cached {len(data['results']['bindings'])} raw results")
    return data


def parse_point(coord_str):
    """Parse 'Point(lng lat)' → (lat, lng)"""
    m = re.match(r"Point\(([-\d.]+)\s+([-\d.]+)\)", coord_str)
    if not m:
        return None, None
    return round(float(m.group(2)), 4), round(float(m.group(1)), 4)


def parse_year(date_str):
    """Extract year from ISO date, handling BCE dates."""
    if not date_str:
        return None
    # Wikidata uses -YYYY or YYYY format
    m = re.match(r"^(-?\d+)", date_str)
    if m:
        return int(m.group(1))
    return None


def qid_from_uri(uri):
    """Extract QID from Wikidata URI."""
    m = re.search(r"(Q\d+)$", uri)
    return m.group(1) if m else None


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def main():
    data = fetch_sparql()
    bindings = data["results"]["bindings"]
    print(f"Raw SPARQL results: {len(bindings)}")

    # Deduplicate by QID, keeping the entry with the most data
    by_qid = {}
    for b in bindings:
        uri = b.get("battle", {}).get("value", "")
        qid = qid_from_uri(uri)
        if not qid:
            continue

        name = b.get("battleLabel", {}).get("value", "")
        coord = b.get("coord", {}).get("value", "")
        date_str = b.get("date", {}).get("value") or b.get("date2", {}).get("value")
        part_of = b.get("partOfLabel", {}).get("value", "")

        lat, lng = parse_point(coord)
        year = parse_year(date_str)

        if lat is None or year is None:
            continue

        # Score: prefer entries with more info
        score = (1 if name else 0) + (1 if part_of else 0)
        if qid not in by_qid or score > by_qid[qid]["_score"]:
            by_qid[qid] = {
                "qid": qid,
                "name": name,
                "lat": lat,
                "lng": lng,
                "year": year,
                "partOf": part_of if part_of else None,
                "_score": score,
            }

    # Build output in the existing schema format
    battles = []
    for qid, b in by_qid.items():
        name = b["name"]
        # Skip entries where the label is just the QID (unresolved)
        if re.fullmatch(r"Q\d+", name):
            continue

        entry = {
            "id": f"wd-{slug(name)}-{b['year']}",
            "name": name,
            "year": b["year"],
            "lat": b["lat"],
            "lng": b["lng"],
            "outcome": "unknown",
            "combatants": "Unknown",
            "commander": "Unknown",
            "description": f"{name} ({abs(b['year'])} {'BC' if b['year'] < 0 else 'AD'})",
            "qid": b["qid"],
            "source": "wikidata",
        }
        if b["partOf"]:
            entry["partOf"] = b["partOf"]
        battles.append(entry)

    battles.sort(key=lambda b: b["year"])

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(battles, f, ensure_ascii=False, indent=2)
        f.write("\n")

    years = [b["year"] for b in battles]
    pre_roman = sum(1 for y in years if y < -509)
    post_byz = sum(1 for y in years if y > 1453)
    roman_era = sum(1 for y in years if -509 <= y <= 1453)

    print(f"\n=== Results ===")
    print(f"Total battles: {len(battles)}")
    print(f"Year range: {min(years)} to {max(years)}")
    print(f"  Before 509 BC: {pre_roman}")
    print(f"  Roman/Byzantine era (-509..1453): {roman_era}")
    print(f"  After 1453: {post_byz}")
    print(f"  With 'part of' conflict: {sum(1 for b in battles if 'partOf' in b)}")
    print(f"\nWrote {os.path.relpath(OUT)} ({os.path.getsize(OUT) // 1024} KB)")


if __name__ == "__main__":
    main()
