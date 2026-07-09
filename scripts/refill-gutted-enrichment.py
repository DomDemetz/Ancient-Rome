#!/usr/bin/env python3
"""Refill enrichment fields on records that kept a verified qid but lost
their wdProps/label in session crossfire (cleanup scripts and parallel
writers repeatedly rewrote cross-reference.json; ~1,000 records ended up
with identity but no facts — the Gier aqueduct's panel was a skeleton).

Sources:
  - label / description / inception / dissolved from the audit's
    ground-truth file (fetched from Wikidata, already on disk)
  - heritage (P1435), architect (P84), materials (P186), area (P2046),
    height (P2048) fetched live WITH units (same conversion rules as
    refetch-quantities-with-units.py)

Only fills gaps — never overwrites an existing field.

Usage: python3 scripts/refill-gutted-enrichment.py <ground-truth.json> [--dry-run]
"""

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic


DATA = Path(__file__).resolve().parent.parent / "src" / "data"
API = "https://www.wikidata.org/w/api.php"
UA = "AncientRomeAtlas-data-audit/1.0 (nsoulfield@gmail.com)"

UNITS = {
    "Q11573": ("length", 1.0), "Q828224": ("length", 1000.0),
    "Q174728": ("length", 0.01), "Q3710": ("length", 0.3048),
    "Q25343": ("area", 1.0), "Q35852": ("area", 10000.0), "Q712226": ("area", 1e6),
}


def api_get(params):
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params),
                                 headers={"User-Agent": UA})
    for a in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception:
            time.sleep(2 ** (a + 1))
    raise RuntimeError("api failed")


def fmt(kind, base):
    if kind == "area":
        return f"{base / 1e6:g} km²" if base >= 100000 else f"{base:g} m²"
    return f"{base / 1000:g} km" if base >= 1000 else f"{base:g} m"


def main():
    gt = json.load(open(sys.argv[1]))
    dry = "--dry-run" in sys.argv
    cr = json.load(open(DATA / "wiki" / "cross-reference.json"))

    gutted = {k: e for k, e in cr.items()
              if e.get("qid") and not k.startswith("wd-")
              and not e.get("wdProps") and not e.get("label")}
    qids = sorted({e["qid"] for e in gutted.values()})
    print(f"gutted records: {len(gutted)} across {len(qids)} QIDs")

    # live fetch: entity-valued + quantity props
    rich = {}
    for i in range(0, len(qids), 50):
        batch = qids[i:i + 50]
        data = api_get({"action": "wbgetentities", "ids": "|".join(batch),
                        "props": "claims", "format": "json", "maxlag": "5"})
        for qid, ent in (data.get("entities") or {}).items():
            if "missing" in ent:
                continue
            cl = ent.get("claims", {})
            out = {}
            ids_to_label = []
            for pid, field in (("P1435", "heritageStatus"), ("P84", "architect"),
                               ("P186", "material")):
                try:
                    v = cl[pid][0]["mainsnak"]["datavalue"]["value"]["id"]
                    out[field] = v  # resolve to label in second pass
                    ids_to_label.append(v)
                except (KeyError, IndexError, TypeError):
                    pass
            for pid, field in (("P2046", "area"), ("P2048", "height")):
                try:
                    v = cl[pid][0]["mainsnak"]["datavalue"]["value"]
                    kind, factor = UNITS.get(v["unit"].rsplit("/", 1)[-1], (None, None))
                    if kind:
                        out[field] = fmt(kind, float(v["amount"]) * factor)
                except (KeyError, IndexError, TypeError, ValueError):
                    pass
            if out:
                rich[qid] = out
        print(f"  {min(i + 50, len(qids))}/{len(qids)}")
        time.sleep(0.3)

    # resolve entity-valued props to labels
    label_qids = sorted({v for r in rich.values() for f, v in r.items()
                         if f in ("heritageStatus", "architect", "material")
                         and isinstance(v, str) and v.startswith("Q")})
    labels = {}
    for i in range(0, len(label_qids), 50):
        data = api_get({"action": "wbgetentities", "ids": "|".join(label_qids[i:i + 50]),
                        "props": "labels", "languages": "en", "format": "json",
                        "maxlag": "5"})
        for qid, ent in (data.get("entities") or {}).items():
            labels[qid] = ent.get("labels", {}).get("en", {}).get("value")
        time.sleep(0.3)
    for r in rich.values():
        for f in ("heritageStatus", "architect", "material"):
            if f in r:
                r[f] = labels.get(r[f]) or None
                if not r[f]:
                    del r[f]

    filled = 0
    for k, e in gutted.items():
        g = gt.get(e["qid"]) or {}
        if g.get("missing"):
            continue
        wd = {}
        # only in-window dates: post-1500 inceptions are rebuild/registration
        # artifacts on otherwise-correct entities (see review/anachronistic-qids)
        if g.get("inception") is not None and -10000 <= g["inception"] <= 1500:
            wd["inception"] = g["inception"]
        if g.get("dissolved") is not None and -10000 <= g["dissolved"] <= 1500:
            wd["dissolved"] = g["dissolved"]
        wd.update(rich.get(e["qid"], {}))
        if g.get("label") and not e.get("label"):
            e["label"] = g["label"]
        if g.get("description") and not e.get("wikidataDescription"):
            e["wikidataDescription"] = g["description"]
        if wd:
            e["wdProps"] = wd
        filled += 1

    print(f"refilled: {filled} records ({len(rich)} with rich props)")
    if dry:
        print("DRY RUN — nothing written")
        return
    dump_atomic(cr, DATA / "wiki" / "cross-reference.json", ensure_ascii=False, indent=1)
    print("cross-reference.json written")


if __name__ == "__main__":
    main()
