#!/usr/bin/env python3
"""Re-extract Wikidata quantity properties WITH units.

The original enrichment (enrich-wikidata-structured.ts) stored bare SPARQL
amounts, silently mixing m2/hectares/km2. This refetches P2046 (area),
P2048 (height), P2049 (width), P2043 (length) for every cross-reference
record that still has a qid + any quantity in wdProps, converts to a
canonical unit, and rewrites the value as a display string with the unit.

Canonical: lengths in m; areas in m2 below 100,000, else km2.

Usage: python3 scripts/refetch-quantities-with-units.py [--dry-run]
"""

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "src" / "data"
API = "https://www.wikidata.org/w/api.php"
UA = "AncientRomeAtlas-data-audit/1.0 (nsoulfield@gmail.com)"

PROPS = {"P2046": "area", "P2048": "height", "P2049": "width", "P2043": "length"}

# unit QID -> (kind, factor to canonical base: m for length, m2 for area)
UNITS = {
    "Q11573": ("length", 1.0),        # metre
    "Q828224": ("length", 1000.0),    # kilometre
    "Q174728": ("length", 0.01),      # centimetre
    "Q3710": ("length", 0.3048),      # foot
    "Q25343": ("area", 1.0),          # square metre
    "Q35852": ("area", 10000.0),      # hectare
    "Q712226": ("area", 1e6),         # square kilometre
    "1": (None, 1.0),                 # dimensionless — unusable
}


def api_get(params):
    qs = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{API}?{qs}", headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            time.sleep(2 ** (attempt + 1))
    raise RuntimeError("API failed after retries")


def fmt_length(m):
    if m >= 1000:
        return f"{m / 1000:g} km"
    return f"{m:g} m"


def fmt_area(m2):
    if m2 >= 100000:
        return f"{m2 / 1e6:g} km²"
    return f"{m2:g} m²"


def main():
    dry = "--dry-run" in sys.argv
    cr = json.load(open(DATA / "wiki" / "cross-reference.json"))

    targets = {}  # qid -> [keys]
    for key, e in cr.items():
        wd = e.get("wdProps") or {}
        if e.get("qid") and any(wd.get(f) for f in PROPS.values()):
            targets.setdefault(e["qid"], []).append(key)
    qids = sorted(targets)
    print(f"{len(qids)} QIDs carry quantities across {sum(len(v) for v in targets.values())} records")

    fetched = {}
    for i in range(0, len(qids), 50):
        batch = qids[i:i + 50]
        data = api_get({"action": "wbgetentities", "ids": "|".join(batch),
                        "props": "claims", "format": "json", "maxlag": "5"})
        for qid, ent in (data.get("entities") or {}).items():
            if "missing" in ent:
                continue
            out = {}
            for pid, field in PROPS.items():
                for c in ent.get("claims", {}).get(pid, []):
                    try:
                        v = c["mainsnak"]["datavalue"]["value"]
                        amount = float(v["amount"])
                        unit_qid = v["unit"].rsplit("/", 1)[-1]
                    except (KeyError, TypeError, ValueError):
                        continue
                    kind, factor = UNITS.get(unit_qid, (None, None))
                    if kind is None:
                        continue
                    base = amount * factor
                    out[field] = fmt_area(base) if kind == "area" else fmt_length(base)
                    break
            fetched[qid] = out
        print(f"  {min(i + 50, len(qids))}/{len(qids)}")
        time.sleep(0.3)

    updated = removed = 0
    for qid, keys in targets.items():
        good = fetched.get(qid, {})
        for key in keys:
            wd = cr[key].get("wdProps") or {}
            for field in PROPS.values():
                if not wd.get(field):
                    continue
                if field in good:
                    if wd[field] != good[field]:
                        wd[field] = good[field]
                        updated += 1
                else:
                    # unit unknown/dimensionless upstream — a bare number is
                    # not a fact; remove rather than keep ambiguity
                    del wd[field]
                    removed += 1

    print(f"updated with units: {updated}, removed (no resolvable unit): {removed}")
    if dry:
        print("DRY RUN — nothing written")
        return
    json.dump(cr, open(DATA / "wiki" / "cross-reference.json", "w"),
              ensure_ascii=False, indent=1)
    print("cross-reference.json updated")


if __name__ == "__main__":
    main()
