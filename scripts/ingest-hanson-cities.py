#!/usr/bin/env python3
"""
Ingest Hanson (2016) OxREP Roman cities dataset into a cities layer.

Source: Oxford Roman Economy Project — "An Urban Geography of the Roman World,
100 BC to AD 300". DOI: 10.5287/bodleian:eqapevAn8
  Cities CSV:  http://oxrep.classics.ox.ac.uk/oxrep/docs/Hanson2016/Hanson2016_Cities_OxREP.csv
  Areas CSV:   http://oxrep.classics.ox.ac.uk/oxrep/docs/Hanson2016/Hanson2016_Areas_OxREP.csv

The Areas table provides estimated inhabited area in hectares; we convert to
population using 175 people/ha (midpoint of the 150–200 range used in Roman
urban demography literature).

Output: src/data/cities/hanson-cities.json

Usage: python3 scripts/ingest-hanson-cities.py
"""
import csv, json, os, re, urllib.request

CITIES_URL = "http://oxrep.classics.ox.ac.uk/oxrep/docs/Hanson2016/Hanson2016_Cities_OxREP.csv"
AREAS_URL = "http://oxrep.classics.ox.ac.uk/oxrep/docs/Hanson2016/Hanson2016_Areas_OxREP.csv"
CITIES_CACHE = "/tmp/hanson-cities.csv"
AREAS_CACHE = "/tmp/hanson-areas.csv"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "data", "cities", "hanson-cities.json")

POP_PER_HA = 175  # midpoint of 150–200 range for Roman urban density


def download(url, path):
    if not os.path.exists(path):
        print(f"downloading {url}…")
        urllib.request.urlretrieve(url, path)


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def parse_year(s: str):
    s = s.strip()
    if not s or s == "NULL":
        return None
    try:
        return int(s)
    except ValueError:
        return None


def main():
    download(CITIES_URL, CITIES_CACHE)
    download(AREAS_URL, AREAS_CACHE)

    # Load areas, keyed by Primary Key
    areas = {}
    with open(AREAS_CACHE, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            pk = row["Primary Key"].strip()
            try:
                areas[pk] = {
                    "areaHa": float(row["Area"].strip()),
                    "estimateBasis": row.get("Estimate Basis", "").strip(),
                }
            except (ValueError, KeyError):
                pass

    # Load cities
    with open(CITIES_CACHE, encoding="latin-1") as f:
        raw_cities = list(csv.DictReader(f))

    results = []
    skipped = 0
    for row in raw_cities:
        name = row["Ancient Toponym"].strip()
        modern = row["Modern Toponym"].strip()
        if not name:
            skipped += 1
            continue

        try:
            lat = float(row["Latitude (Y)"].strip())
            lng = float(row["Longitude (X)"].strip())
        except (ValueError, KeyError):
            skipped += 1
            continue

        start = parse_year(row["Start Date"])
        end = parse_year(row["End Date"])
        if start is None:
            skipped += 1
            continue

        # NULL end date means the city was still urban at AD 300
        if end is None:
            end = 300

        pk = row["Primary Key"].strip()
        rank = row.get("Barrington Atlas Rank", "").strip()
        province = row.get("Province", "").strip()
        country = row.get("Country", "").strip()

        entry = {
            "id": "hanson-" + slug(name),
            "name": name,
            "modernName": modern,
            "lat": round(lat, 4),
            "lng": round(lng, 4),
            "province": province,
            "country": country,
            "startYear": start,
            "endYear": end,
            "barringtonRank": rank,
            "source": "hanson-oxrep",
        }

        area_info = areas.get(pk)
        if area_info:
            ha = area_info["areaHa"]
            entry["areaHa"] = ha
            entry["estimatedPopulation"] = round(ha * POP_PER_HA)

        results.append(entry)

    # Deduplicate IDs — some cities appear multiple times with different date ranges
    seen_ids = {}
    for entry in results:
        eid = entry["id"]
        if eid in seen_ids:
            entry["id"] = eid + "-" + str(entry["startYear"])
        seen_ids[eid] = True

    results.sort(key=lambda c: c["startYear"])

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
        f.write("\n")

    with_area = sum(1 for r in results if "areaHa" in r)
    yrs = [c["startYear"] for c in results] + [c["endYear"] for c in results]
    pops = [c["estimatedPopulation"] for c in results if "estimatedPopulation" in c]
    print(f"✓ {len(results)} cities  ({min(yrs)}..{max(yrs)})")
    print(f"  with area data: {with_area}  |  without: {len(results) - with_area}")
    if pops:
        print(f"  estimated pop range: {min(pops):,} – {max(pops):,}")
    print(f"  skipped: {skipped}")
    print(f"  wrote {os.path.relpath(OUT)}  ({os.path.getsize(OUT)//1024} KB)")

    # Rank distribution
    ranks = {}
    for r in results:
        rk = r.get("barringtonRank", "-")
        ranks[rk] = ranks.get(rk, 0) + 1
    print(f"  ranks: { {k: v for k, v in sorted(ranks.items())} }")


if __name__ == "__main__":
    main()
