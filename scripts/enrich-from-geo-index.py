#!/usr/bin/env python3
"""Fill image/description gaps from the local Wikidata geo-index.

The 88GB dump distilled to wikidata-geo-index.json (11.4M geolocated
entities: label, coords, desc, Commons image, P31). This pass gives every
QID-bearing cross-reference entry that lacks an image/description the
dump's values — zero API calls, rerunnable, additive only (never
overwrites an existing value; we don't invent data, and we don't clobber
curated enrichment either).
"""

import json
from pathlib import Path
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic

DATA = Path(__file__).resolve().parent.parent / "src" / "data"
INDEX = DATA / "downloads" / "wikidata-geo-index.json"


def commons_url(filename: str) -> str:
    return ("https://commons.wikimedia.org/wiki/Special:FilePath/"
            + filename.replace(" ", "_") + "?width=640")


def main():
    if not INDEX.exists():
        print("geo-index not present — skipping (downloads/ is gitignored)")
        return
    print("loading geo-index (1.6GB)...")
    idx = json.load(open(INDEX))

    cr_path = DATA / "wiki" / "cross-reference.json"
    cr = json.load(open(cr_path))
    img_added = desc_added = 0
    for entry in cr.values():
        qid = entry.get("qid")
        if not qid or qid not in idx:
            continue
        rec = idx[qid]
        if not entry.get("imageUrl") and rec.get("img"):
            entry["imageUrl"] = commons_url(rec["img"])
            entry.setdefault("imageSrc", "Wikidata")
            img_added += 1
        if not entry.get("wikidataDescription") and rec.get("desc"):
            entry["wikidataDescription"] = rec["desc"]
            desc_added += 1
    dump_atomic(cr, cr_path, ensure_ascii=False, separators=(",", ":"))
    print(f"cross-reference: +{img_added} images, +{desc_added} descriptions "
          f"({len(cr)} entries)")


if __name__ == "__main__":
    main()
