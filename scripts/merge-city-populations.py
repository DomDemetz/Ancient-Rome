#!/usr/bin/env python3
"""
Merge Chandler, Modelski, and Hanson city datasets into a single
historical-cities.json conforming to the existing HistoricalCity schema.

Deduplication: name+coords proximity (<0.5°). When duplicates exist,
prefer the source with a richer population time series.
"""
import json, math, os, re

ROOT = os.path.join(os.path.dirname(__file__), "..")
CHANDLER = os.path.join(ROOT, "src/data/cities/historical-cities.json")
MODELSKI = os.path.join(ROOT, "src/data/cities/modelski-cities.json")
HANSON   = os.path.join(ROOT, "src/data/cities/hanson-cities.json")
OUT      = CHANDLER  # overwrite the canonical file

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

def load(path):
    with open(path) as f:
        return json.load(f)

def conform_hanson(h):
    """Convert a Hanson entry to the HistoricalCity schema."""
    mid = (h["startYear"] + h["endYear"]) // 2
    est = h.get("estimatedPopulation")
    if est:
        populations = [{"year": mid, "population": est}]
        peak = est
    else:
        populations = []
        peak = 0
    return {
        "id": h["id"],
        "name": h["name"],
        "lat": h["lat"],
        "lng": h["lng"],
        "country": h.get("country", ""),
        "startYear": h["startYear"],
        "endYear": h["endYear"],
        "peakPopulation": peak,
        "populations": populations,
        "source": "hanson-oxrep",
    }

def dedup_key(name):
    return re.sub(r"[^a-z]+", "", name.lower())

def close(a, b, threshold=0.5):
    return abs(a["lat"] - b["lat"]) < threshold and abs(a["lng"] - b["lng"]) < threshold

def pop_richness(entry):
    return len(entry.get("populations", []))

def merge_populations(a, b):
    """Merge population series from two entries, keeping unique years."""
    seen = {}
    for p in a.get("populations", []) + b.get("populations", []):
        y = p["year"]
        if y not in seen or p["population"] > seen[y]:
            seen[y] = p["population"]
    return sorted([{"year": y, "population": pop} for y, pop in seen.items()], key=lambda x: x["year"])


def main():
    chandler = load(CHANDLER)
    modelski = load(MODELSKI)
    hanson_raw = load(HANSON)
    hanson = [conform_hanson(h) for h in hanson_raw]

    print(f"Input: {len(chandler)} Chandler, {len(modelski)} Modelski, {len(hanson)} Hanson")

    # Build index from Chandler (primary)
    merged = list(chandler)
    index = {}
    for i, c in enumerate(merged):
        index[dedup_key(c["name"])] = i

    # Add Modelski — merge populations if duplicate, else add
    m_merged, m_new = 0, 0
    for m in modelski:
        key = dedup_key(m["name"])
        if key in index and close(m, merged[index[key]]):
            existing = merged[index[key]]
            existing["populations"] = merge_populations(existing, m)
            existing["peakPopulation"] = max(p["population"] for p in existing["populations"]) if existing["populations"] else 0
            existing["startYear"] = min(existing["startYear"], m["startYear"])
            existing["endYear"] = max(existing["endYear"], m["endYear"])
            m_merged += 1
        else:
            index[key] = len(merged)
            merged.append(m)
            m_new += 1

    # Add Hanson — merge if duplicate, else add
    h_merged, h_new, h_skip = 0, 0, 0
    for h in hanson:
        key = dedup_key(h["name"])
        if key in index and close(h, merged[index[key]]):
            existing = merged[index[key]]
            if h["populations"]:
                existing["populations"] = merge_populations(existing, h)
                existing["peakPopulation"] = max(p["population"] for p in existing["populations"]) if existing["populations"] else existing["peakPopulation"]
            existing["startYear"] = min(existing["startYear"], h["startYear"])
            existing["endYear"] = max(existing["endYear"], h["endYear"])
            h_merged += 1
        elif not h["populations"]:
            # Hanson entry with no population and no match — still add for coverage
            index[key] = len(merged)
            merged.append(h)
            h_new += 1
        else:
            index[key] = len(merged)
            merged.append(h)
            h_new += 1

    merged.sort(key=lambda c: c["startYear"])

    with open(OUT, "w") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
        f.write("\n")

    with_pop = sum(1 for c in merged if c.get("populations"))
    yrs = [c["startYear"] for c in merged] + [c["endYear"] for c in merged]
    sources = {}
    for c in merged:
        s = c.get("source", "unknown")
        sources[s] = sources.get(s, 0) + 1

    print(f"\nMerge results:")
    print(f"  Modelski: {m_merged} merged into existing, {m_new} new")
    print(f"  Hanson:   {h_merged} merged into existing, {h_new} new")
    print(f"\nOutput: {len(merged)} total cities  ({min(yrs)}..{max(yrs)})")
    print(f"  With population data: {with_pop}")
    print(f"  Without: {len(merged) - with_pop}")
    print(f"  By source: {sources}")
    print(f"  Wrote {os.path.relpath(OUT)} ({os.path.getsize(OUT) // 1024} KB)")


if __name__ == "__main__":
    main()
