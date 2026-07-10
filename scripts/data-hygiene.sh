#!/usr/bin/env bash
# The complete data-hygiene pipeline, in the only order that works.
# Run after ANY enrichment, matching, or cleanup pass — partial runs are
# how every data regression this week happened.
#
# Usage: bash scripts/data-hygiene.sh [path-to-qid-ground-truth.json]
#   Without a ground-truth path, the refill step is skipped (the rest is
#   offline). Generate ground truth with scripts/fetch-qid-ground-truth.py.
set -euo pipefail
cd "$(dirname "$0")/.."

GT="${1:-}"

echo "══ 1/7 tombstones — deliberate removals stay removed"
python3 scripts/enforce-qid-tombstones.py

if [ -n "$GT" ] && [ -f "$GT" ]; then
  echo "══ 2/7 same-QID adjudication (plan)"
  python3 scripts/resolve-same-qid-groups.py "$GT"
  echo "══ 3/7 apply plan (demotes/strips/links)"
  python3 scripts/apply-same-qid-plan.py
  echo "══ 4/7 refill crossfire-gutted records"
  python3 scripts/refill-gutted-enrichment.py "$GT"
else
  echo "══ 2-4/7 skipped (no ground-truth file given)"
fi

echo "══ 5/8 re-apply construction dates (WD inceptions + overrides)"
python3 scripts/apply-wd-inceptions.py
echo "══ 6/8 rebuild entity table"
python3 scripts/build-entity-table.py
echo "══ 7/8 rebuild search manifest"
python3 scripts/build-entity-search.py
echo "══ 8/8 gates"
python3 scripts/validate-golden.py
python3 scripts/validate-entities.py --ci
echo "══ hygiene complete — all gates green"
