#!/usr/bin/env bash
# Pre-push guard: every src/data JSON that differs from origin/master must
# parse. Exists because a crashed write truncated cross-reference.json
# mid-string (2026-07-10 00:46) and reached CI — both sessions commit
# --no-verify, so pre-push is the only local gate that runs.
set -euo pipefail
cd "$(dirname "$0")/.."

changed=$(git diff --name-only origin/master...HEAD -- 'src/data/**/*.json' 'src/data/*.json' 2>/dev/null || true)
[ -z "$changed" ] && exit 0

fail=0
while IFS= read -r f; do
  [ -f "$f" ] || continue # deleted files
  if ! python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$f" 2>/dev/null; then
    echo "✗ MALFORMED JSON: $f (truncated write?)"
    fail=1
  fi
done <<< "$changed"

exit $fail
