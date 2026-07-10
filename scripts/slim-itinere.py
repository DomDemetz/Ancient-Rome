#!/usr/bin/env python3
"""Strip itinere road props to what ItinereRoadLayer actually reads.

The generated file carried stringly placeholders ("None", "False",
startYear "0") and four fields nothing consumes — 1.5 MB of the 5.7 MB
network. Keeps: name, type, certainty, builder, attestedYear,
territoryYear, declineYear — and drops placeholder values (the layer
treats missing as unknown). territoryYear drives shouldShowRoad's
conquest-correlated visibility — dropping it hides the whole network.
Idempotent; rerun after generate-itinere-roads.ts.
"""

import json
import os

PATH = os.path.join(
    os.path.dirname(__file__), "..", "src", "data", "itinere", "roads-temporal.json"
)
KEEP = ("name", "type", "certainty", "builder", "attestedYear", "territoryYear", "declineYear")
PLACEHOLDERS = {"None", "False", "0", "", None}

d = json.load(open(PATH))
before = os.path.getsize(PATH)
for f in d.get("features", []):
    p = f.get("properties", {})
    f["properties"] = {k: p[k] for k in KEEP if p.get(k) not in PLACEHOLDERS}
with open(PATH, "w") as out:
    json.dump(d, out, ensure_ascii=False, separators=(",", ":"))
    out.write("\n")
print(f"itinere roads: {before // 1024} KB -> {os.path.getsize(PATH) // 1024} KB")
