#!/usr/bin/env python3
"""
P0 VICI MIGRATION (data side): split the 16 MB vici-sites.json monolith
into per-siteType chunks under src/data/vici/, dropping the 3,377
settlement-kind points already represented by canonical place nodes
(registry/vici-merged.json — the node draws the city; ViciLayer's MERGED
suppression becomes unnecessary once the loader swaps to chunks).

Loader contract preserved exactly (ViciSite fields). Runtime swap is a
one-line import change in useMapLayerStore — deferred while session B's
refactor holds that file (see board).
"""
import json, os
from collections import defaultdict

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")
sites = json.load(open(os.path.join(BASE, "vici-sites.json")))
merged = set(json.load(open(os.path.join(BASE, "registry", "vici-merged.json"))))

by_type = defaultdict(list)
dropped = 0
for s in sites:
    r = s.get("properties", s)
    if r["id"] in merged:
        dropped += 1
        continue
    by_type[r.get("siteType") or "other"].append(r)

out_dir = os.path.join(BASE, "vici")
os.makedirs(out_dir, exist_ok=True)
index = {}
for t, recs in sorted(by_type.items()):
    fname = f"{t}.json"
    p = os.path.join(out_dir, fname)
    json.dump(recs, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
    open(p, "a").write("\n")
    index[t] = {"file": fname, "count": len(recs), "kb": os.path.getsize(p) // 1024}
    print(f"  vici/{fname:20} {len(recs):6} sites  {os.path.getsize(p)//1024:5} KB")
json.dump(index, open(os.path.join(out_dir, "chunks.json"), "w"), indent=1)
open(os.path.join(out_dir, "chunks.json"), "a").write("\n")
print(f"total {sum(v['count'] for v in index.values())} sites in {len(index)} chunks "
      f"(dropped {dropped} node-merged); monolith was 16 MB")
