#!/usr/bin/env bash
# Build all derived data files in the correct order.
# Usage: npm run build-data   (or: bash scripts/build-data.sh)
#
# Steps:
#   1. Build canonical place nodes (merges DARE + Chandler + Pleiades + Vici)
#   2. Validate data integrity
#   3. Print coverage report
set -euo pipefail
cd "$(dirname "$0")/.."

echo "══════════════════════════════════════════"
echo "  STEP 1 · Build canonical place nodes"
echo "══════════════════════════════════════════"
python3 scripts/build-entities.py
echo ""

echo "══════════════════════════════════════════"
echo "  STEP 1b · Join unified entities to canonical nodes"
echo "══════════════════════════════════════════"
python3 scripts/attach-nodes-to-unified.py
echo ""

echo "══════════════════════════════════════════"
echo "  STEP 2 · Validate data integrity"
echo "══════════════════════════════════════════"
python3 -c "
import json, sys

places = json.load(open('src/data/places/places.json'))
setl_wiki = json.load(open('src/data/wiki/settlements-wiki.json'))
cross_ref = json.load(open('src/data/wiki/cross-reference.json'))

errors = []

# Every wiki ref must resolve
for p in places:
    w = p.get('wiki')
    if not w: continue
    layer, key = w
    if layer == 'settlements' and key not in setl_wiki:
        errors.append(f'  BROKEN wiki ref: {p[\"name\"]} -> settlements[{key}]')

# No node should reference cities-wiki anymore
cities_refs = [p for p in places if p.get('wiki') and p['wiki'][0] == 'cities']
if cities_refs:
    errors.append(f'  {len(cities_refs)} nodes still reference cities-wiki (should be 0)')

# Population nodes should have wiki
pop_nodes = [p for p in places if p.get('populations')]
pop_no_wiki = [p for p in pop_nodes if not p.get('wiki')]
if len(pop_no_wiki) > 110:
    errors.append(f'  {len(pop_no_wiki)} pop nodes without wiki (expected ~100 post-Roman)')

# Check for duplicate IDs
ids = [p['id'] for p in places]
dupes = [id for id in set(ids) if ids.count(id) > 1]
if dupes:
    errors.append(f'  Duplicate node IDs: {dupes[:5]}')

if errors:
    print('VALIDATION ERRORS:')
    for e in errors:
        print(e)
    sys.exit(1)
else:
    print('All checks passed.')
"
echo ""

echo "══════════════════════════════════════════"
echo "  STEP 2b · Provenance manifest"
echo "══════════════════════════════════════════"
python3 scripts/build-manifest.py
echo ""

echo "══════════════════════════════════════════"
echo "  STEP 3 · Coverage report"
echo "══════════════════════════════════════════"
python3 -c "
import json

places = json.load(open('src/data/places/places.json'))
setl_wiki = json.load(open('src/data/wiki/settlements-wiki.json'))
cross_ref = json.load(open('src/data/wiki/cross-reference.json'))

total = len(places)
with_wiki = sum(1 for p in places if p.get('wiki'))
with_pop = sum(1 for p in places if p.get('populations'))
pop_with_wiki = sum(1 for p in places if p.get('populations') and p.get('wiki'))
with_pid = sum(1 for p in places if p.get('pid'))
with_qid = sum(1 for p in places if p.get('qid'))
merged = sum(1 for p in places if p.get('dare') and p.get('populations'))

# Description quality
custom = generic = pleiades_covered = 0
for k, v in setl_wiki.items():
    ext = v.get('extract', '')
    rea = v.get('romanEraExtract', '')
    is_custom = ext[:80] != rea[:80] if ext and rea else False
    cr_key = f'settlement:{k}'
    has_pleiades = bool(cross_ref.get(cr_key, {}).get('pleiadesDescription', ''))
    if is_custom:
        custom += 1
    elif has_pleiades:
        pleiades_covered += 1
    else:
        generic += 1

print(f'Place nodes:         {total:>7,}')
print(f'  with wiki:         {with_wiki:>7,}  ({100*with_wiki/total:.1f}%)')
print(f'  with Pleiades ID:  {with_pid:>7,}')
print(f'  with Wikidata ID:  {with_qid:>7,}')
print(f'  merged DARE+pop:   {merged:>7,}')
print()
print(f'Population nodes:    {with_pop:>7,}')
print(f'  with wiki:         {pop_with_wiki:>7,}  ({100*pop_with_wiki/with_pop:.0f}%)')
print()
print(f'Wiki entries:        {len(setl_wiki):>7,}')
print(f'  custom Roman text: {custom:>7,}')
print(f'  Pleiades covered:  {pleiades_covered:>7,}')
print(f'  generic:           {generic:>7,}')
"
echo ""
echo "Done."
