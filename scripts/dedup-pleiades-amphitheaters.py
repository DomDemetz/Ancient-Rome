#!/usr/bin/env python3
"""Remove Pleiades cross-ref amphitheaters that duplicate existing entries.

The 2026-07-07 Pleiades ingest (440acae) added ~30 amphitheater entries
stamped with the period-placeholder startYear=-100. Most are the same
physical monuments as existing roman-amphitheaters entries (different
name, same coordinates) — e.g. 'Roman amphitheater at *Moridunum' next
to 'Carmarthen'. Because their placeholder date predates the real
construction years by centuries, they surface as stray dots on the map
from 100 BC (an amphitheater in Wales 150 years before the invasion).

Rule: a Pleiades-source entry with the -100 placeholder that sits within
1.5 km of any better-dated entry is a duplicate — the original wins.
"""

import json
import math

PATH = 'src/data/unified/amphitheater.json'
PLACEHOLDER = -100


def km(a, b):
    return math.hypot(
        (a['lat'] - b['lat']) * 111.0,
        (a['lng'] - b['lng']) * 111.0 * math.cos(math.radians(a['lat'])),
    )


def main():
    data = json.load(open(PATH))
    placeholders = [
        e for e in data
        if e.get('source') == 'Pleiades' and e.get('startYear') == PLACEHOLDER
    ]
    keep_pool = [e for e in data if e not in placeholders]

    removed = []
    for e in placeholders:
        partner = next((o for o in keep_pool if km(e, o) < 1.5), None)
        if partner is not None:
            removed.append((e, partner))
        else:
            keep_pool.append(e)  # genuinely new site — keep it

    kept = [e for e in data if e not in [r for r, _ in removed]]
    print(f'total {len(data)} -> {len(kept)} (removed {len(removed)} duplicates)')
    for e, p in removed:
        print(f"  - {e['name']!r} (dupe of {p['name']!r}, {km(e, p):.2f} km)")

    with open(PATH, 'w') as f:
        json.dump(kept, f, indent=2, ensure_ascii=False)
        f.write('\n')


if __name__ == '__main__':
    main()
