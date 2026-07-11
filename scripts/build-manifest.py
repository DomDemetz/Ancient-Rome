#!/usr/bin/env python3
"""
DATA-MANIFEST.json — provenance for every shipped data artifact: source,
license, version/date, producing script, record count, size, sha256 (first
12 hex). 77 ingest scripts and zero provenance records was the gap; this
runs as the last build-data step so the manifest can never drift.
"""
import glob, hashlib, json, os
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic


BASE = os.path.join(os.path.dirname(__file__), "..")
D = os.path.join(BASE, "src", "data")

# artifact -> (source, license, version note, producing script)
CATALOG = {
    "places/places.json": ("DARE + Chandler/Reba + Pleiades + Wikidata + Vici (merged)", "CC-BY / CC-BY-SA / CC0 mix — see DATA-SOURCES.md", "built from sources below", "build-entities.py"),
    "territories/territories.json": ("Cliopatria (Seshat)", "CC-BY 4.0", "v0.2.0 (2026-05)", "build-territories-cliopatria.py"),
    "empires/empires.json": ("Cliopatria (Seshat)", "CC-BY 4.0", "v0.2.0 (2026-05), full 3400 BC–2024 AD span", "ingest-cliopatria.py"),
    "dare/provinces.json": ("curated Principate set + DARMC/MPS late-antique snapshots", "mixed; DARMC portion CC-BY-NC-SA 4.0", "DARMC fetched 2026-07-11", "ingest-darmc-provinces.py"),
    "dare/islamic-conquests.json": ("DARMC/MPS Islamic conquest phases 622-750", "CC-BY-NC-SA 4.0", "fetched 2026-07-11", "ingest-islamic-conquests.py"),
    "empires/seshat.json": ("Seshat Databank API (capitals, polity descriptions)", "CC-BY (Seshat)", "fetched 2026-07-11", "build-seshat-enrichment.py"),
    "vici-sites.json": ("vici.org SQL dump", "CC-BY-SA 3.0", "dump 2023-10-08", "ingest-vici.ts"),
    "dare/settlements.json": ("DARE (Digital Atlas of the Roman Empire)", "CC-BY 4.0", "via vici dump 2023-10-08", "ingest scripts (dare)"),
    "cities/historical-cities.json": ("Chandler via Reba, Reitsma & Seto 2016", "CC-BY 4.0", "FigShare chandlerV2", "ingest-chandler-cities.py"),
    "pleiades-all.json": ("Pleiades gazetteer", "CC-BY 3.0", "flattened export", "(pre-existing ingest)"),
    "epigraphy/epigraphy.json": ("EDH-derived density", "CC-BY-SA", "(pre-existing ingest)", "(pre-existing ingest)"),
    "registry/pleiades-wikidata.json": ("Wikidata SPARQL P1584 + vici q_pleiades", "CC0", "fetched 2026-07-05/06", "fetch-pleiades-wikidata-bridge.py"),
    "knowledge/places.json": ("consolidated: wiki/* + cross-reference (graph-keyed)", "inherits sources", "build-time", "build-knowledge.py"),
    "knowledge/features.json": ("consolidated: wiki/* + cross-reference (graph-keyed)", "inherits sources", "build-time", "build-knowledge.py"),
    "knowledge/other.json": ("consolidated: emperors/legions/entities wiki", "inherits sources", "build-time", "build-knowledge.py"),
    "registry/unified-nodes.json": ("derived join", "inherits sources", "build-time", "attach-nodes-to-unified.py"),
    "registry/crosswalk-dare.json": ("derived join", "inherits sources", "build-time", "build-place-crosswalks.py"),
    "registry/crosswalk-vici.json": ("vici pmetadata (native)", "CC-BY-SA 3.0", "dump 2023-10-08", "build-vici-crosswalk.py"),
    "registry/crosswalk-battles.json": ("Wikidata SPARQL", "CC0", "fetched 2026-07-06", "build-battle-crosswalk.py"),
    "registry/crosswalk-orbis.json": ("derived join", "inherits sources", "build-time", "integrate-orbis-nodes.py"),
    "trade/orbis-temporal.json": ("ORBIS v2 (Stanford), place-node joined", "MIT", "orbis_v2 + join 2026-07-07", "ingest-orbis.ts + integrate-orbis-nodes.py"),
    "trade/orbis.json": ("ORBIS v2 (Stanford), place-node joined", "MIT", "orbis_v2 + join 2026-07-07", "ingest-orbis.ts + integrate-orbis-nodes.py"),
}

manifest = {"generated": None, "note": "regenerate via scripts/build-manifest.py (build-data step)", "artifacts": []}
for rel, (src, lic, ver, script) in sorted(CATALOG.items()):
    p = os.path.join(D, rel)
    if not os.path.exists(p):
        continue
    raw = open(p, "rb").read()
    try:
        data = json.loads(raw)
        if isinstance(data, dict) and "features" in data:
            count = len(data["features"])
        elif isinstance(data, dict) and "sites" in data and "routes" in data:
            count = len(data["sites"]) + len(data["routes"])
        else:
            count = len(data)
    except Exception:
        count = None
    manifest["artifacts"].append({
        "file": f"src/data/{rel}", "records": count, "bytes": len(raw),
        "sha256_12": hashlib.sha256(raw).hexdigest()[:12],
        "source": src, "license": lic, "version": ver, "producer": f"scripts/{script}",
    })
# unified chunks, one summary row each
for p in sorted(glob.glob(os.path.join(D, "unified", "*.json"))):
    raw = open(p, "rb").read()
    manifest["artifacts"].append({
        "file": os.path.relpath(p, BASE), "records": len(json.loads(raw)), "bytes": len(raw),
        "sha256_12": hashlib.sha256(raw).hexdigest()[:12],
        "source": "unified migration of per-layer sources", "license": "see DATA-SOURCES.md",
        "version": "build-time", "producer": "scripts/build-unified-entities.ts",
    })
out = os.path.join(BASE, "DATA-MANIFEST.json")
dump_atomic(manifest, out, ensure_ascii=False, indent=1)

# landing-page stats, DERIVED — the hardcoded ribbon went stale three
# times in one day as the datasets moved
import glob as _glob
D = os.path.join(BASE, "src", "data")
def _n(p):
    return len(json.load(open(os.path.join(D, p))))
stats = {
    "settlements": _n("places/places.json"),
    "archaeologicalSites": sum(len(json.load(open(f))) for f in _glob.glob(os.path.join(D, "vici", "*.json"))),
    "buildings": _n("unified/building.json"),
    "people": _n("registry/people-search.json"),
    "battles": _n("unified/battle.json"),
    "emperors": _n("registry/emperors-search.json"),
}
sp = os.path.join(D, "registry", "landing-stats.json")
dump_atomic(stats, sp, separators=(",", ":"))
open(sp, "a").write("\n")
print("landing-stats.json:", stats)
open(out, "a").write("\n")
print(f"DATA-MANIFEST.json: {len(manifest['artifacts'])} artifacts, "
      f"{sum(a['bytes'] for a in manifest['artifacts'])//1024//1024} MB tracked")
