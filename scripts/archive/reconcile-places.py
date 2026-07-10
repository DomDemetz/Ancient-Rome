#!/usr/bin/env python3
"""
PROTOTYPE / measurement — not wired into the app.

De-risks the "canonical entity" architecture by measuring how well the place
datasets deduplicate against each other with fuzzy matching only (name +
coordinate proximity), since the flattened data carries no shared IDs.

Answers: if we merged DARE + Pleiades + Chandler into canonical entities, how
many duplicates collapse, how reliable are the merges, and where does it break?

Usage: python3 scripts/reconcile-places.py
"""
import json, math, os, unicodedata, re
from collections import defaultdict

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")


def load(path):
    d = json.load(open(os.path.join(BASE, path)))
    return d if isinstance(d, list) else d.get("features", [])


def norm(name: str) -> str:
    s = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode()
    s = s.lower()
    s = re.sub(r"\(.*?\)", "", s)  # drop parentheticals
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    # strip common noise tokens
    for t in (" ad ", " the ", " ancient ", " modern ", " colonia ", " municipium "):
        s = s.replace(t, " ")
    return re.sub(r"\s+", " ", s).strip()


def km(a, b):
    (la1, lo1), (la2, lo2) = a, b
    r = 6371.0
    p1, p2 = math.radians(la1), math.radians(la2)
    dp = math.radians(la2 - la1)
    dl = math.radians(lo2 - lo1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1, math.sqrt(h)))


# --- load sources (place-level) ---
sources = {
    "pleiades": load("pleiades-all.json"),
    "dare": load("dare/settlements.json"),
    "chandler": load("cities/historical-cities.json"),
}
recs = []
for src, arr in sources.items():
    for r in arr:
        p = r.get("properties", r)
        try:
            lat, lng = float(p["lat"]), float(p["lng"])
        except (KeyError, TypeError, ValueError):
            continue
        recs.append({"src": src, "name": p.get("name", ""), "n": norm(p.get("name", "")), "lat": lat, "lng": lng})

print(f"Loaded {len(recs)} place records: " + ", ".join(f"{k}={len(v)}" for k, v in sources.items()))

# --- spatial grid index (~0.25 deg cells) for near-neighbour lookup ---
grid = defaultdict(list)
for i, r in enumerate(recs):
    grid[(round(r["lat"] * 4), round(r["lng"] * 4))].append(i)


def neighbours(i):
    r = recs[i]
    gy, gx = round(r["lat"] * 4), round(r["lng"] * 4)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            yield from grid.get((gy + dy, gx + dx), [])


# --- PAIRWISE best-match (no transitive chaining) ---
# A record matches another source's record only if names agree AND they're the
# single nearest such candidate within a tight radius. Cities get a looser radius
# (coords are coarser) than archaeological points.
by_src = defaultdict(list)
for i, r in enumerate(recs):
    by_src[r["src"]].append(i)


def best_match(i, target_src, radius):
    """nearest same-name record from target_src within radius km, else None"""
    ri = recs[i]
    if not ri["n"]:
        return None
    best, bestd = None, radius
    for j in neighbours(i):
        rj = recs[j]
        if rj["src"] != target_src or not rj["n"] or rj["n"] != ri["n"]:
            continue
        d = km((ri["lat"], ri["lng"]), (rj["lat"], rj["lng"]))
        if d <= bestd:
            best, bestd = j, d
    return best


# 1) Pleiades <-> DARE overlap (two Roman gazetteers of the same world)
dare_dupe = sum(1 for i in by_src["dare"] if best_match(i, "pleiades", 10.0) is not None)
print(f"\nPleiades↔DARE: {dare_dupe}/{len(by_src['dare'])} DARE settlements have a same-name Pleiades place ≤10 km")
print(f"  → ~{dare_dupe} rows are the SAME place stored twice (real dedup, high confidence)")

# 2) Chandler cities -> existing (exact name, then loose)
ch = by_src["chandler"]
ch_exact = [i for i in ch if best_match(i, "pleiades", 25) is not None or best_match(i, "dare", 25) is not None]
print(f"\nChandler→existing (exact name ≤25 km): {len(ch_exact)}/{len(ch)} match an existing place")
print(f"  → {len(ch) - len(ch_exact)} Chandler cities have NO exact-name match — the genuinely-new medieval fill (or name variants)")

# quality: a few famous cities, resolved pairwise
print("\nSample resolutions (pairwise, tight):")
for nm in ("Rome", "Constantinople", "Cordoba", "Carthage"):
    idx = next((i for i in ch if recs[i]["n"] == norm(nm)), None)
    if idx is None:
        print(f"  {nm:15} not in Chandler")
        continue
    p = best_match(idx, "pleiades", 25)
    dd = best_match(idx, "dare", 25)
    hits = []
    if p is not None:
        hits.append(f"pleiades '{recs[p]['name']}' {km((recs[idx]['lat'],recs[idx]['lng']),(recs[p]['lat'],recs[p]['lng'])):.0f}km")
    if dd is not None:
        hits.append(f"dare '{recs[dd]['name']}' {km((recs[idx]['lat'],recs[idx]['lng']),(recs[dd]['lat'],recs[dd]['lng'])):.0f}km")
    print(f"  {nm:15} -> {hits if hits else 'NO MATCH (name drift, e.g. Cordoba↔Corduba)'}")
