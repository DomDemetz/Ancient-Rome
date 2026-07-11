#!/usr/bin/env python3
"""Apply kind-enrichment research verdicts to the cross-reference store.

Input: registry/kind-enrichment.json — {entity id: {desc, qid?, wiki?}},
high-confidence research-swarm output (theaters/amphitheaters/palaces/
fora/basilicas/sanctuaries, 2026-07-11 recipe: evidence packet + targeted
web search, null over guessing, hand-audited samples).

Additive only: description/qid/wikiUrl land on the entity's cross-ref
entry ONLY where that field is empty (never clobbers curated content).
Entities without a cross-ref entry get a minimal one — that makes them
panel-openable, and entries gaining a wikiUrl graduate to knowledge tier
on the next atlas emit. Rerunnable.
"""

import json
from pathlib import Path
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic

DATA = Path(__file__).resolve().parent.parent / "src" / "data"


def main():
    reg_path = DATA / "registry" / "kind-enrichment.json"
    if not reg_path.exists():
        print("no kind-enrichment registry — skipping")
        return
    reg = json.load(open(reg_path))
    cr_path = DATA / "wiki" / "cross-reference.json"
    cr = json.load(open(cr_path))

    # entity id -> its cross-ref detail key (the atlas emit's mapping)
    names = {}
    atlas_dir = DATA / "entities" / "atlas"
    for f in atlas_dir.glob("*.json"):
        if f.name in ("chunks.json", "sources.json"):
            continue
        for r in json.load(open(f)):
            names[r["i"]] = {"key": r.get("d") or r["i"], "name": r.get("n")}

    created = desc_n = qid_n = wiki_n = 0
    for eid, v in reg.items():
        meta = names.get(eid)
        key = (meta or {}).get("key") or eid
        entry = cr.get(key)
        if entry is None:
            entry = cr[key] = {"label": (meta or {}).get("name") or eid,
                               "sources": ["Research"]}
            created += 1
        if v.get("desc") and not entry.get("description"):
            entry["description"] = v["desc"]
            entry.setdefault("descriptionSrc", "research-2026-07")
            desc_n += 1
        if v.get("qid") and not entry.get("qid"):
            entry["qid"] = v["qid"]
            qid_n += 1
        if v.get("wiki") and not entry.get("wikiUrl"):
            entry["wikiUrl"] = ("https://en.wikipedia.org/wiki/"
                                + v["wiki"].replace(" ", "_"))
            wiki_n += 1

    dump_atomic(cr, cr_path, ensure_ascii=False, separators=(",", ":"))
    print(f"applied: +{desc_n} descriptions, +{qid_n} qids, +{wiki_n} wiki links "
          f"({created} new cross-ref entries) — rerun build-knowledge + "
          f"build-entity-atlas to ship")


if __name__ == "__main__":
    main()
