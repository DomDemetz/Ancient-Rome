#!/usr/bin/env python3
"""Split the 14.6 MB Cliopatria empires monolith into era buckets.

The World preset paid the full download for every year; a 117 AD view
needs 2.1 MB of shapes, not 14.6. Shapes spanning a boundary appear in
each bucket they overlap (~3% duplication — consumers dedupe by id).
Buckets mirror src/data/empires/index.ts EMPIRE_ERAS; keep in sync.
"""

import json
import os

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data", "empires")
BUCKETS = [(-3700, -800), (-800, 0), (0, 500), (500, 1000), (1000, 1500), (1500, 1800), (1800, 2025)]

d = json.load(open(os.path.join(BASE, "empires.json")))
for i, (lo, hi) in enumerate(BUCKETS):
    inb = [e for e in d if e["from"] < hi and e["to"] >= lo]
    p = os.path.join(BASE, f"era-{i}.json")
    with open(p, "w") as f:
        json.dump(inb, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print(f"era-{i}.json ({lo}..{hi}): {len(inb)} shapes, {os.path.getsize(p) // 1024} KB")
