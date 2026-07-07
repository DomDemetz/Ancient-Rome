#!/usr/bin/env python3
"""Floor ESTIMATED start dates to the year Rome actually held the spot.

The Pleiades ingest stamped period-bucket placeholders on undated sites
(villas -100, temples -500, tombs -600, bridges -200, aqueducts -300...).
Result: "Roman villa" render in Britain from 100 BC — a century before
the invasion. For every unified-chunk item whose dates are flagged
estimatedTemporal, this floors startYear at the first territory snapshot
(territories.json, status=controlled) whose polygon contains the point.

Attested dates are never touched, and sites that never fall inside Roman
territory keep their estimate (frontier finds, client kingdoms). Same
data the map itself renders, so a floored site appears exactly when its
province turns red. Idempotent; rerunnable after any re-ingest.
"""

import glob
import json
import os
from shapely.geometry import Point, shape
from shapely.prepared import prep

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")

# Rome only: the estimates encode ROMAN-period buckets. (Eastern-empire
# snapshots continue the same polity after 395 — included.)
TERRITORY_IDS = {"rome", "eastern-empire"}


def load_snapshots():
    t = json.load(open(os.path.join(BASE, "territories", "territories.json")))
    snaps = []
    for s in t:
        if s["id"] not in TERRITORY_IDS or s["status"] != "controlled":
            continue
        try:
            geom = shape(s["boundaries"]["geometry"])
        except Exception:
            continue
        if not geom.is_valid:
            geom = geom.buffer(0)
        snaps.append((s["year"], prep(geom), geom))
    snaps.sort(key=lambda x: x[0])
    return snaps


def first_controlled_year(snaps, pt, cache):
    key = (round(pt.x, 2), round(pt.y, 2))
    if key in cache:
        return cache[key]
    year = None
    for y, prepped, _ in snaps:
        if prepped.contains(pt):
            year = y
            break
    cache[key] = year
    return year


def main():
    snaps = load_snapshots()
    print(f"{len(snaps)} controlled territory snapshots loaded")
    cache = {}
    total_floored = 0
    for f in sorted(glob.glob(os.path.join(BASE, "unified", "*.json"))):
        d = json.load(open(f))
        items = d if isinstance(d, list) else d.get("features", [])
        floored = 0
        for it in items:
            p = it.get("properties", it)
            if not p.get("estimatedTemporal"):
                continue
            s = p.get("startYear")
            lat, lng = p.get("lat"), p.get("lng")
            if s is None or lat is None or lng is None:
                continue
            y = first_controlled_year(snaps, Point(lng, lat), cache)
            # never floor past the (estimated) end: a site ending 500 must
            # not "start" at Justinian's 555 reconquest of its province
            e = p.get("endYear")
            if y is not None and s < y and (e in (None, 0) or y <= e):
                p["startYear"] = y
                floored += 1
        if floored:
            with open(f, "w") as out:
                json.dump(d, out, ensure_ascii=False, separators=(",", ":"))
                out.write("\n")
            print(f"  {os.path.basename(f):28} floored {floored}")
            total_floored += floored
    print(f"total floored: {total_floored}")


if __name__ == "__main__":
    main()
