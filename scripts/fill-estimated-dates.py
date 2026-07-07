#!/usr/bin/env python3
"""
Fill in estimated temporal data for entities missing startYear/endYear.
Marks them with estimatedTemporal: true so they can be refined later.

Uses conservative type-based defaults:
- Villas: 100 BC - 500 AD (Republican to late Roman)
- Temples: 500 BC - 400 AD (Greek-influenced to Theodosian edicts)
- Bridges: 200 BC - 500 AD (Roman engineering era)
- Tombs: 600 BC - 500 AD (broad, since tombs span all periods)
- Aqueducts: 300 BC - 500 AD (Roman water infrastructure)

Also extracts specific dates from names/descriptions when possible.
"""

import json
import os
import re
import sys

UNIFIED = "src/data/unified"

DEFAULTS = {
    "discovery-villa.json": (-100, 500),
    "discovery-temple.json": (-500, 400),
    "discovery-bridge.json": (-200, 500),
    "discovery-tomb.json": (-600, 500),
    "aqueduct.json": (-300, 500),
}

DATE_PATTERNS = [
    (re.compile(r'(\d{1,4})\s*BCE?\b', re.I), -1),
    (re.compile(r'(\d{1,4})\s*(?:AD|CE)\b', re.I), 1),
    (re.compile(r'(\d{1,2})(?:st|nd|rd|th)\s*century\s*BCE?\b', re.I), -100),
    (re.compile(r'(\d{1,2})(?:st|nd|rd|th)\s*century\s*(?:AD|CE)?\b', re.I), 100),
]


def extract_year(text):
    for pattern, multiplier in DATE_PATTERNS:
        m = pattern.search(text)
        if m:
            num = int(m.group(1))
            if abs(multiplier) == 100:
                return (num - 1) * multiplier
            return num * multiplier
    return None


def main():
    dry_run = '--dry-run' in sys.argv
    total_filled = 0
    total_extracted = 0

    for filename, (default_start, default_end) in DEFAULTS.items():
        path = f"{UNIFIED}/{filename}"
        if not os.path.exists(path):
            continue

        data = json.load(open(path))
        filled = 0
        extracted = 0

        for entity in data:
            if entity.get('startYear') or entity.get('endYear'):
                continue

            text = f"{entity.get('name', '')} {entity.get('description', '')}"
            year = extract_year(text)

            if year is not None:
                entity['startYear'] = year - 50
                entity['endYear'] = year + 50
                entity['estimatedTemporal'] = True
                extracted += 1
            else:
                entity['startYear'] = default_start
                entity['endYear'] = default_end
                entity['estimatedTemporal'] = True
                filled += 1

        total_filled += filled
        total_extracted += extracted
        name = filename.replace('.json', '')
        print(f"{name:25s} {extracted:4d} date-extracted, {filled:4d} default-filled "
              f"(of {len(data)} total)")

        if not dry_run:
            with open(path, 'w') as f:
                json.dump(data, f, separators=(',', ':'))

    print(f"\nTotal: {total_extracted} extracted from text, {total_filled} filled with defaults")
    if dry_run:
        print("(dry run)")


if __name__ == "__main__":
    main()
