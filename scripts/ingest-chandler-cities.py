#!/usr/bin/env python3
"""
Ingest the Chandler historical city-population dataset (Reba, Reitsma & Seto 2016,
CC-BY) into a time-tracked cities layer.

Source: FigShare 10.6084/m9.figshare.2059494 (chandlerV2.csv), a wide table where
each row is a city and each column a year (BC_2250 ... AD_1975) holding population.

Output: src/data/cities/historical-cities.json — one record per city, with the full
(year, population) series and derived start/end years. Every record is date-bounded,
so a city only renders within the years it is actually attested. Temporal range is
kept in full; geography is limited to the atlas frame (a config, easy to widen).

Usage: python3 scripts/ingest-chandler-cities.py
"""
import csv, json, os, re, urllib.request

SRC_URL = "https://ndownloader.figshare.com/files/5407640"  # chandlerV2.csv
CACHE = "/tmp/chandler.csv"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "data", "cities", "historical-cities.json")

# Atlas frame — the Roman world and its neighbours. A config, not a hard limit:
# widen these for the global "atlas of human history" vision.
LAT_MIN, LAT_MAX = 18.0, 66.0
LNG_MIN, LNG_MAX = -15.0, 70.0


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
        print("downloading Chandler CSV…")
        urllib.request.urlretrieve(SRC_URL, CACHE)

    with open(CACHE, encoding="latin-1") as f:
        rows = list(csv.reader(f))

    header = rows[0]
    year_cols = [(i, col_to_year(c)) for i, c in enumerate(header) if col_to_year(c) is not None]

    cities, skipped = [], 0
    for r in rows[1:]:
        if len(r) < 6:
            continue
        name = r[0].strip()
        try:
            lat, lng = float(r[3]), float(r[4])
        except ValueError:
            skipped += 1
            continue
        if not (LAT_MIN <= lat <= LAT_MAX and LNG_MIN <= lng <= LNG_MAX):
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
            pop = int(digits)  # Chandler figures are absolute population counts
            series.append({"year": year, "population": pop})

        if not series:
            continue
        series.sort(key=lambda p: p["year"])
        cities.append({
            "id": "chandler-" + slug(name) + "-" + str(series[0]["year"]),
            "name": name,
            "lat": round(lat, 4),
            "lng": round(lng, 4),
            "country": r[2].strip(),
            "startYear": series[0]["year"],
            "endYear": series[-1]["year"],
            "peakPopulation": max(p["population"] for p in series),
            "populations": series,
            "source": "chandler-reba",
        })

    cities.sort(key=lambda c: c["startYear"])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(cities, f, ensure_ascii=False, indent=2)
        f.write("\n")

    yrs = [c["startYear"] for c in cities] + [c["endYear"] for c in cities]
    med = [c for c in cities if c["endYear"] > 800]
    print(f"✓ {len(cities)} cities  ({min(yrs)}..{max(yrs)})  |  {len(med)} active past 800  |  skipped {skipped}")
    print(f"  wrote {os.path.relpath(OUT)}  ({os.path.getsize(OUT)//1024} KB)")


if __name__ == "__main__":
    main()
