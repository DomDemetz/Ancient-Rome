#!/usr/bin/env python3
"""
Extend provinces to Cliopatria's actual borders: every part of the empire
mask not covered by any province is assigned to the adjacent province with
the greatest shared-edge contact. Pieces touching no province (e.g. the
Justinianic Crimea, never a regular province) are left unassigned.

Run AFTER clip (exact congruence both ways: no overhang, no shortfall).
"""
import json, os
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

BASE = 'src/data'
terr = json.load(open(f'{BASE}/territories/territories.json'))
def snap_at(tid, year):
    return max((t for t in terr if t['id']==tid and t['year']<=year), key=lambda t: t['year'])
mask = unary_union([
    shape(snap_at('rome', 117)['boundaries']['geometry']).buffer(0),
    shape(snap_at('eastern-empire', 555)['boundaries']['geometry']).buffer(0),
])

ppath = f'{BASE}/dare/provinces.json'
provs = json.load(open(ppath))
feats = provs['features'] if isinstance(provs, dict) else provs
geoms = [shape(f['geometry']).buffer(0) for f in feats]

gap = mask.difference(unary_union(geoms))
pieces = list(gap.geoms) if gap.geom_type == 'MultiPolygon' else [gap]
assigned = skipped = 0
adds = [[] for _ in feats]
for piece in pieces:
    if piece.area < 0.02:
        continue
    probe = piece.buffer(0.03)
    best_i, best_score = None, 0.0
    for i, g in enumerate(geoms):
        score = probe.intersection(g).area
        if score > best_score:
            best_i, best_score = i, score
    if best_i is None or best_score < 1e-4:
        skipped += 1
        continue
    adds[best_i].append(piece)
    assigned += 1

for i, f in enumerate(feats):
    if not adds[i]:
        continue
    merged = unary_union([geoms[i], *adds[i]]).intersection(mask)
    f['geometry'] = mapping(merged.simplify(0.003))
    print(f"  +{sum(p.area for p in adds[i]):5.1f} deg² -> {f['properties']['name']}")

json.dump(provs, open(ppath, 'w'), ensure_ascii=False, separators=(',',':'))
open(ppath, 'a').write('\n')
print(f"assigned {assigned} gap pieces, skipped {skipped} (no adjacency) — {os.path.getsize(ppath)//1024} KB")
