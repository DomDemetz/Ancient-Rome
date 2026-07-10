#!/usr/bin/env python3
"""
Enrich Wikidata settlements with population time-series via SPARQL.

Queries P1082 (population) with P585 (point in time) qualifiers for all QIDs
in wikidata-ancient-settlements.json.  Caches intermediate results so the run
can be resumed after interruption.

Usage: python3 scripts/enrich-wikidata-population.py
"""
import json, os, re, time, urllib.request, urllib.parse, urllib.error, math

INPUT = os.path.join(os.path.dirname(__file__), "..",
                     "src", "data", "downloads", "wikidata-ancient-settlements.json")
OUTPUT = os.path.join(os.path.dirname(__file__), "..",
                      "src", "data", "downloads", "wikidata-population-enrichment.json")
CACHE = "/tmp/wikidata-pop-cache.json"

SPARQL_URL = "https://query.wikidata.org/sparql"
BATCH_SIZE = 200
MIN_DELAY = 1.2  # seconds between requests

HEADERS = {
    "User-Agent": "AncientRomeAtlas/1.0 (https://github.com; nsoulfield@gmail.com) Python/3",
    "Accept": "application/sparql-results+json",
}


def sparql_query(qids: list[str]) -> list[dict]:
    values = " ".join(f"wd:{q}" for q in qids)
    query = f"""
SELECT ?item ?pop ?date WHERE {{
  VALUES ?item {{ {values} }}
  ?item p:P1082 ?stmt .
  ?stmt ps:P1082 ?pop .
  OPTIONAL {{ ?stmt pq:P585 ?date }}
}}
"""
    url = SPARQL_URL + "?" + urllib.parse.urlencode({"query": query})
    req = urllib.request.Request(url, headers=HEADERS)

    backoff = 2
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read())
                return data["results"]["bindings"]
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                wait = backoff * (2 ** attempt)
                print(f"  HTTP {e.code}, backing off {wait}s (attempt {attempt+1}/5)")
                time.sleep(wait)
            else:
                raise
        except Exception as e:
            wait = backoff * (2 ** attempt)
            print(f"  Error: {e}, backing off {wait}s (attempt {attempt+1}/5)")
            time.sleep(wait)

    print(f"  FAILED after 5 attempts, skipping batch")
    return []


def extract_year(date_str: str) -> int | None:
    if not date_str:
        return None
    m = re.match(r"^(-?\d{4})", date_str)
    return int(m.group(1)) if m else None


def extract_qid(uri: str) -> str:
    return uri.rsplit("/", 1)[-1]


def main():
    with open(INPUT) as f:
        settlements = json.load(f)
    all_qids = [s["qid"] for s in settlements]
    print(f"Loaded {len(all_qids)} QIDs from settlements")

    # Load cache
    result: dict[str, list[dict]] = {}
    cached_batches: set[int] = set()
    if os.path.exists(CACHE):
        with open(CACHE) as f:
            cache = json.load(f)
            result = cache.get("data", {})
            cached_batches = set(cache.get("done_batches", []))
        print(f"Resumed from cache: {len(result)} QIDs, {len(cached_batches)} batches done")

    batches = [all_qids[i:i+BATCH_SIZE] for i in range(0, len(all_qids), BATCH_SIZE)]
    total_batches = len(batches)
    print(f"Total batches: {total_batches} ({BATCH_SIZE} QIDs each)")

    for idx, batch in enumerate(batches):
        if idx in cached_batches:
            continue

        bindings = sparql_query(batch)

        for b in bindings:
            qid = extract_qid(b["item"]["value"])
            pop_val = b["pop"]["value"]
            try:
                pop = int(float(pop_val))
            except (ValueError, TypeError):
                continue

            year = None
            if "date" in b and b["date"].get("value"):
                year = extract_year(b["date"]["value"])

            if qid not in result:
                result[qid] = []

            entry = {"population": pop}
            if year is not None:
                entry["year"] = year
            result[qid].append(entry)

        cached_batches.add(idx)

        if (idx + 1) % 10 == 0 or idx == total_batches - 1:
            print(f"  batch {idx+1}/{total_batches} — {len(result)} QIDs with population so far")
            with open(CACHE, "w") as f:
                json.dump({"data": result, "done_batches": sorted(cached_batches)}, f)

        time.sleep(MIN_DELAY)

    # Post-process: sort and deduplicate population series
    output = {}
    for qid, pops in result.items():
        seen = set()
        clean = []
        for p in pops:
            key = (p.get("year"), p["population"])
            if key in seen:
                continue
            seen.add(key)
            clean.append(p)
        clean.sort(key=lambda x: (x.get("year") or 9999, x["population"]))
        output[qid] = {"populations": clean}

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
        f.write("\n")

    # Stats
    with_year = sum(1 for v in output.values()
                    if any(p.get("year") for p in v["populations"]))
    total_points = sum(len(v["populations"]) for v in output.values())
    print(f"\n✓ Done: {len(output)} QIDs with population data")
    print(f"  {with_year} have dated population points")
    print(f"  {total_points} total population data points")
    print(f"  {len(all_qids) - len(output)} QIDs with no population data")
    print(f"  Wrote {os.path.relpath(OUTPUT)} ({os.path.getsize(OUTPUT)//1024} KB)")

    # Clean up cache
    if os.path.exists(CACHE):
        os.remove(CACHE)
        print("  Cleaned up cache")


if __name__ == "__main__":
    main()
