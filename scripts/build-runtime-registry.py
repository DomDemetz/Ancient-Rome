#!/usr/bin/env python3
"""
Derive the SMALL search manifests the app loads eagerly. (The former
dare-suppression/chandler-qid artifacts are superseded by the canonical
place nodes — scripts/build-entities.py — which merge rather than patch.)
"""
import json, os
from collections import defaultdict

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")
R = os.path.join(BASE, "registry")

cities = {c["id"]: c for c in json.load(open(os.path.join(BASE, "cities", "historical-cities.json")))}

# --- cities-search.json: tiny eager manifest for the search bar ---
# name/lat/lng + [startYear, endYear] clamped to the atlas window, plus the
# year of peak population WITHIN the window (search jumps there when the city
# doesn't exist at the current year). Cities entirely outside the window are
# excluded.
MIN_YEAR, MAX_YEAR = -753, 1453
search = []
for c in cities.values():
    pts = [p for p in c["populations"] if MIN_YEAR <= p["year"] <= MAX_YEAR]
    if not pts and c["startYear"] > MAX_YEAR:
        continue  # founded after the atlas window
    if not pts:
        # attested only outside the window but alive inside it (interpolated)
        if c["endYear"] < MIN_YEAR or c["startYear"] > MAX_YEAR:
            continue
        peak_year = max(MIN_YEAR, min(MAX_YEAR, c["startYear"]))
    else:
        peak_year = max(pts, key=lambda p: p["population"])["year"]
    search.append({
        "id": c["id"],
        "n": c["name"],
        "lat": c["lat"],
        "lng": c["lng"],
        "s": max(c["startYear"], MIN_YEAR),
        "e": min(c["endYear"], MAX_YEAR),
        "p": peak_year,
    })
p3 = os.path.join(R, "cities-search.json")
json.dump(search, open(p3, "w"), ensure_ascii=False, separators=(",", ":"))
open(p3, "a").write("\n")
print(f"cities-search.json: {len(search)} cities ({os.path.getsize(p3)//1024} KB)")


# --- emperors-search.json + battles-search.json: eager search manifests ---
# Emperors aren't indexed by search at all today, and battles only appear
# after their layer lazy-loads. Both datasets are small; a manifest makes
# "Justinian" and "Manzikert" work from the default view.
emperors = json.load(open(os.path.join(BASE, "emperors", "emperors.json")))
emp = [{
    "id": e["id"], "n": e["name"],
    "s": e["reignStart"], "e": e["reignEnd"],
    "d": e.get("dynasty") or "",
} for e in emperors]
p4 = os.path.join(R, "emperors-search.json")
json.dump(emp, open(p4, "w"), ensure_ascii=False, separators=(",", ":"))
open(p4, "a").write("\n")
print(f"emperors-search.json: {len(emp)} emperors ({os.path.getsize(p4)//1024} KB)")

battles = json.load(open(os.path.join(BASE, "battles", "battles.json")))
bat = [{
    "id": b["id"], "n": b["name"], "y": b["year"],
    "lat": b["lat"], "lng": b["lng"],
} for b in battles]
p5 = os.path.join(R, "battles-search.json")
json.dump(bat, open(p5, "w"), ensure_ascii=False, separators=(",", ":"))
open(p5, "a").write("\n")
print(f"battles-search.json: {len(bat)} battles ({os.path.getsize(p5)//1024} KB)")


# --- empires-search.json: one entry per distinct polity ---
# Search "Sasanian Empire" from cold start: fly to the polity's heartland
# (its largest shape's label anchor) and, if the current year is outside its
# lifespan, jump to the year of its greatest extent.
empires = json.load(open(os.path.join(BASE, "empires", "empires.json")))
by_name = {}
for e in empires:
    b = by_name.setdefault(e["name"], {"from": e["from"], "to": e["to"], "best": e})
    b["from"] = min(b["from"], e["from"])
    b["to"] = max(b["to"], e["to"])
    if e["area"] > b["best"]["area"]:
        b["best"] = e
emp_search = []
for name, b in by_name.items():
    best = b["best"]
    emp_search.append({
        "id": best["id"],
        "n": name,
        "lat": best["label"][0],
        "lng": best["label"][1],
        "s": b["from"],
        "e": min(b["to"], 1453),
        "p": min(max((best["from"] + best["to"]) // 2, -753), 1453),
    })
p6 = os.path.join(R, "empires-search.json")
json.dump(emp_search, open(p6, "w"), ensure_ascii=False, separators=(",", ":"))
open(p6, "a").write("\n")
print(f"empires-search.json: {len(emp_search)} polities ({os.path.getsize(p6)//1024} KB)")


# --- people-search.json: notable historical figures ---
people_path = os.path.join(BASE, "people-layer", "notable-people.json")
if os.path.exists(people_path):
    people = json.load(open(people_path))
    ppl = [{
        "id": p["wikidataId"], "n": p["name"],
        "lat": p["birthLat"], "lng": p["birthLng"],
        "b": p["born"], "d": p.get("died"),
        "r": p.get("role", ""),
    } for p in people]
    p7 = os.path.join(R, "people-search.json")
    json.dump(ppl, open(p7, "w"), ensure_ascii=False, separators=(",", ":"))
    open(p7, "a").write("\n")
    print(f"people-search.json: {len(ppl)} people ({os.path.getsize(p7)//1024} KB)")

# --- buildings-search.json: all unified entities (searchable without loading layers) ---
UNIFIED = os.path.join(BASE, "unified")
bsearch = []
source_types = [
    ("building.json", "building"),
    ("amphitheater.json", "amphitheater"),
    ("discovery-tomb.json", "tomb"),
    ("discovery-villa.json", "villa"),
    ("discovery-temple.json", "temple"),
    ("discovery-bridge.json", "bridge"),
    ("mine.json", "mine"),
    ("aqueduct.json", "aqueduct"),
    ("shipwreck.json", "shipwreck"),
    ("religious-site.json", "religion"),
    ("press.json", "press"),
    ("port.json", "port"),
]
for fname, short in source_types:
    fpath = os.path.join(UNIFIED, fname)
    if not os.path.exists(fpath):
        continue
    data = json.load(open(fpath))
    for e in data:
        bsearch.append({"id": e["id"], "n": e["name"], "lat": e["lat"], "lng": e["lng"], "t": short})
p8 = os.path.join(R, "buildings-search.json")
json.dump(bsearch, open(p8, "w"), ensure_ascii=False, separators=(",", ":"))
open(p8, "a").write("\n")
print(f"buildings-search.json: {len(bsearch)} sites ({os.path.getsize(p8)//1024} KB)")
