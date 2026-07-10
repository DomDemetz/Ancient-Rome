#!/usr/bin/env python3
"""
Ingest the Modelski historical city-population dataset (Reba, Reitsma & Seto 2016,
CC-BY) into a time-tracked cities layer.

Source: FigShare 10.6084/m9.figshare.2059497 (modelskiAncientV2.csv), a wide table
where each row is a city and each column a year (BC_3700 ... AD_1000) holding
population. Covers 154 cities from 3700 BC to AD 1000, with deeper ancient coverage
(Mesopotamia, Egypt, Indus Valley) than the companion Chandler dataset.

Output: src/data/cities/modelski-cities.json — one record per city, with the full
(year, population) series and derived start/end years. Format matches the Chandler
output so they can be merged or displayed together.

Usage: python3 scripts/ingest-modelski-cities.py
"""
import csv, json, os, re, urllib.request

SRC_URL = "https://ndownloader.figshare.com/files/5356132"  # modelskiAncientV2.csv
CACHE = "/tmp/modelski.csv"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "data", "cities", "modelski-cities.json")

LAT_MIN, LAT_MAX = 18.0, 66.0
LNG_MIN, LNG_MAX = -15.0, 70.0

# Modelski uses modern names; map well-known ones to their historical equivalents
# within our atlas frame.
HISTORICAL_NAMES = {
    "Istanbul": "Constantinople",
    "Izmir": "Smyrna",
    "Iznik": "Nicaea",
}


def col_to_year(col: str):
    m = re.match(r"^(BC|AD)_(\d+)$", col)
    if not m:
        return None
    y = int(m.group(2))
    return -y if m.group(1) == "BC" else y


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    if not os.path.exists(CACHE):
        print("downloading Modelski CSV…")
        urllib.request.urlretrieve(SRC_URL, CACHE)

    with open(CACHE, encoding="latin-1") as f:
        rows = list(csv.reader(f))

    header = rows[0]
    # Columns: City, OtherName, Country, Latitude, Longitude, Certainty, BC_3700 ...
    year_cols = [(i, col_to_year(c)) for i, c in enumerate(header) if col_to_year(c) is not None]

    cities, skipped, outside_frame = [], 0, 0
    for r in rows[1:]:
        if len(r) < 6:
            continue
        name = r[0].strip()
        name = HISTORICAL_NAMES.get(name, name)
        alt_name = r[1].strip() if len(r) > 1 else ""
        try:
            lat, lng = float(r[3]), float(r[4])
        except ValueError:
            skipped += 1
            continue
        if not (LAT_MIN <= lat <= LAT_MAX and LNG_MIN <= lng <= LNG_MAX):
            outside_frame += 1
            continue

        series = []
        for i, year in year_cols:
            if i >= len(r):
                break
            cell = r[i].strip()
            if not cell:
                continue
            digits = re.sub(r"[^\d]", "", cell)
            if not digits:
                continue
            pop = int(digits)
            series.append({"year": year, "population": pop})

        if not series:
            continue
        series.sort(key=lambda p: p["year"])
        entry = {
            "id": "modelski-" + slug(name) + "-" + str(series[0]["year"]),
            "name": name,
            "lat": round(lat, 4),
            "lng": round(lng, 4),
            "country": r[2].strip(),
            "startYear": series[0]["year"],
            "endYear": series[-1]["year"],
            "peakPopulation": max(p["population"] for p in series),
            "populations": series,
            "source": "modelski",
        }
        if alt_name:
            entry["altName"] = alt_name
        cities.append(entry)

    cities.sort(key=lambda c: c["startYear"])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(cities, f, ensure_ascii=False, indent=2)
        f.write("\n")

    yrs = [c["startYear"] for c in cities] + [c["endYear"] for c in cities]
    print(f"✓ {len(cities)} cities  ({min(yrs)}..{max(yrs)})  |  outside frame: {outside_frame}  |  skipped: {skipped}")
    print(f"  wrote {os.path.relpath(OUT)}  ({os.path.getsize(OUT)//1024} KB)")

    # Overlap check with Chandler
    chandler_path = os.path.join(os.path.dirname(OUT), "historical-cities.json")
    if os.path.exists(chandler_path):
        with open(chandler_path) as f:
            chandler = json.load(f)
        ch_names = set(c["name"].lower() for c in chandler)
        mo_names = set(c["name"].lower() for c in cities)
        overlap = ch_names & mo_names
        print(f"  Chandler overlap: {len(overlap)} shared names out of {len(cities)} Modelski cities")
        if overlap:
            print(f"    shared: {', '.join(sorted(overlap)[:15])}{'…' if len(overlap) > 15 else ''}")


if __name__ == "__main__":
    main()
