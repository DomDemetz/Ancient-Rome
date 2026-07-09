#!/usr/bin/env python3
"""
THE MERGE — build the canonical place nodes.

One node per real-world place. Every dataset that knows about the place
attaches to the same node via the crosswalks (see ENTITY-MODEL.md):

  identity   pid (Pleiades) and/or qid (Wikidata)
  geometry   coords: Pleiades > DARE > Chandler (most scholarly first)
  lifespan   widest attested span across sources (0 = unknown, per DARE)
  rendering  DARE type/major codes (legend + zoom rules), Chandler population
             curve (sizing + labels)
  knowledge  wiki ref pointing at whichever enrichment file knows the place

Scope note (honest): nodes are built for every place that RENDERS today —
the union of DARE settlements and in-window Chandler cities. Pleiades-only
records contribute identity/coords when linked but do not yet add 13k new
dots; extending node coverage to the full gazetteer is step 6 in the doc.

Output: src/data/places/places.json
Usage:  python3 scripts/build-entities.py
"""
import json, os, re
from collections import defaultdict
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic


BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")
R = os.path.join(BASE, "registry")

dare = json.load(open(os.path.join(BASE, "dare", "settlements.json")))
chandler = json.load(open(os.path.join(BASE, "cities", "historical-cities.json")))
pleiades = {str(p.get("properties", p)["id"]): p.get("properties", p)
            for p in json.load(open(os.path.join(BASE, "pleiades-all.json")))}
xw_dare = json.load(open(os.path.join(R, "crosswalk-dare.json")))
xw_ch = json.load(open(os.path.join(R, "crosswalk-chandler.json")))
dare_qid = json.load(open(os.path.join(R, "dare-wikidata.json")))
bridge = json.load(open(os.path.join(R, "pleiades-wikidata.json")))
setl_wiki = json.load(open(os.path.join(BASE, "wiki", "settlements-wiki.json")))
vici = [v.get("properties", v) for v in json.load(open(os.path.join(BASE, "vici-sites.json")))]
xw_vici = json.load(open(os.path.join(R, "crosswalk-vici.json")))
wd_settlements = json.load(open(os.path.join(R, "wd-settlements.json")))
SETTLEMENT_KINDS = {"settlement", "city", "town", "vicus"}

def clean_qid(q):
    """Registry qid fields sometimes carry annotations ('Qazvin (Q181578)',
    'Q3523866: Roman baths of Gaujac' — sometimes a DIFFERENT entity's id).
    Only a bare Q-id is trustworthy identity."""
    return q if q and re.fullmatch(r"Q\d+", q) else None

MIN_YEAR, MAX_YEAR = -753, 1453

# --- group source records by canonical key ---
# key = pleiades pid when linked, else the source's own namespaced id
groups = defaultdict(lambda: {"dare": [], "chandler": [], "pid": None})
for s in dare:
    did = str(s["id"])
    pid = xw_dare.get(did, {}).get("pid")
    key = f"pl-{pid}" if pid else f"dare-{did}"
    g = groups[key]
    g["dare"].append(s)
    if pid: g["pid"] = pid
for c in chandler:
    if c["startYear"] > MAX_YEAR:
        continue  # never renders in the atlas window
    pid = xw_ch.get(c["id"], {}).get("pid")
    key = f"pl-{pid}" if pid else f"ch-{c['id']}"
    g = groups[key]
    g["chandler"].append(c)
    if pid: g["pid"] = pid

places, stats = [], defaultdict(int)
for key, g in groups.items():
    ds = g["dare"]; cs = g["chandler"]; pid = g["pid"]
    pl = pleiades.get(pid) if pid else None
    # representative dare record: prefer major, then lowest type code (city-most)
    d = sorted(ds, key=lambda s: (not s.get("major"), s.get("type", 99)))[0] if ds else None
    c = cs[0] if cs else None

    # coords: Pleiades > DARE > Chandler
    if pl and pl.get("lat") is not None:
        lat, lng = float(pl["lat"]), float(pl["lng"])
    elif d:
        lat, lng = d["lat"], d["lng"]
    else:
        lat, lng = c["lat"], c["lng"]

    # name: Chandler (curated display) > DARE > Pleiades. strip() guards the
    # whitespace-name records (a blank DARE name beat Pleiades' 'Bucium' and
    # shipped an unnamed popup as pl-206989)
    def _n(v):
        return (v or "").strip() or None
    name = (
        (c and _n(c["name"])) or (d and _n(d["name"])) or (pl and _n(pl.get("name"))) or "?"
    )

    # lifespan: widest attested span; keep DARE's 0 = unknown semantics only
    # when no source gives a real bound
    starts = [v for v in ([d.get("startYear") if d else None, c["startYear"] if c else None]) if v not in (None, 0)]
    ends = [v for v in ([d.get("endYear") if d else None, c["endYear"] if c else None]) if v not in (None, 0)]
    start = min(starts) if starts else 0
    end = max(ends) if ends else 0

    qid = clean_qid(
        (d and dare_qid.get(str(d["id"]))) or (pid and bridge.get(pid, {}).get("qid"))
        or (c and xw_ch.get(c["id"], {}).get("qid")) or None
    )

    # knowledge ref: single unified wiki layer
    wiki = None
    if d and str(d["id"]) in setl_wiki:
        wiki = ["settlements", str(d["id"])]
    elif c and c["id"] in setl_wiki:
        wiki = ["settlements", c["id"]]

    node = {
        "id": key,
        "name": name,
        "lat": round(lat, 5),
        "lng": round(lng, 5),
        "startYear": start,
        "endYear": end,
    }
    if pid: node["pid"] = pid
    if qid: node["qid"] = qid
    if wiki: node["wiki"] = wiki
    if d:
        node["dare"] = {
            "id": str(d["id"]), "type": d.get("type"), "major": bool(d.get("major")),
        }
        for k in ("territoryYear", "declineYear"):
            if d.get(k) is not None:
                node["dare"][k] = d[k]
        if d.get("modern") and d["modern"] != name:
            node["modern"] = d["modern"]
    if c:
        node["populations"] = c["populations"]
    places.append(node)
    stats["nodes"] += 1
    if ds and cs: stats["merged dare+chandler"] += 1
    if len(ds) > 1: stats["multi-dare collapsed"] += 1
    if qid: stats["with qid"] += 1
    if wiki: stats["with wiki"] += 1
    if pid: stats["with pid"] += 1

# --- attach Vici sites to their nodes (native pmetadata identity) ---
node_by_key = {}
dare_to_key = {}
for p in places:
    node_by_key[p["id"]] = p
    if "dare" in p:
        dare_to_key[p["dare"]["id"]] = p["id"]

vici_by_id = {v["id"]: v for v in vici}
vici_attached = set()
vici_merged = []  # settlement-kind vici points that ARE the place (skip in ViciLayer)
for vid, link in xw_vici.items():
    v = vici_by_id.get(vid)
    if v is None:
        continue
    key = None
    if link.get("pid") and f"pl-{link['pid']}" in node_by_key:
        key = f"pl-{link['pid']}"
    elif link.get("dare") and link["dare"] in dare_to_key:
        key = dare_to_key[link["dare"]]
    if key is None:
        continue
    node = node_by_key[key]
    node.setdefault("vici", []).append(vid)
    vici_attached.add(vid)
    # adopt only a clean Q-id: the vici field sometimes holds annotations
    # ("Q3523866: Roman baths of Gaujac" — the monument's qid, not the
    # town's) and adopting those mislabels the settlement node
    if "qid" not in node and clean_qid(link.get("qid")):
        node["qid"] = link["qid"]
        stats["qid adopted from vici"] += 1
    if (v.get("siteType") or "").lower() in SETTLEMENT_KINDS:
        vici_merged.append(vid)
    stats["vici attached"] += 1

# --- pleiades-only settlements become minor nodes ---
have_pids = {p["pid"] for p in places if "pid" in p}
for pid, pr in pleiades.items():
    if pid in have_pids:
        continue
    pt = str(pr.get("placeType", "")).lower()
    if not any(k in pt for k in ("settlement", "polis", "urban")):
        continue
    try:
        lat, lng = float(pr["lat"]), float(pr["lng"])
    except (KeyError, TypeError, ValueError):
        continue
    name = str(pr.get("name") or "?").split("/")[0].strip() or "?"
    node = {
        "id": f"pl-{pid}",
        "name": name,
        "lat": round(lat, 5),
        "lng": round(lng, 5),
        "startYear": pr.get("startYear") or 0,
        "endYear": pr.get("endYear") or 0,
        "pid": pid,
        "minor": True,  # gazetteer-only: subtle style, high zoom threshold
    }
    q = clean_qid(bridge.get(pid, {}).get("qid"))
    if q:
        node["qid"] = q
    places.append(node)
    stats["pleiades-only nodes"] += 1

# --- Wikidata dated settlements (SPARQL snapshot, registry/wd-settlements.json) ---
# Worldwide gazetteer texture, esp. the medieval gap the archaeological
# sources can't cover. Window-filtered at build time (the atlas ends 1453);
# QIDs already claimed by a richer node are skipped (no duplicate dots).
ATLAS_END = 1453
# zero-start gate: startYear 0 means UNKNOWN inception, and 0 renders at
# every year — 20th-century ghost towns (Kansas, Chernobyl-zone Belarus)
# were appearing in 753 BC. A zero-start settlement stays only if its
# P31 type says antiquity (fetch-wd-types.py) or it died in-window.
WD_ANCIENT_TYPES = {
    "Q15661340",  # ancient city
    "Q839954",   # archaeological site
    "Q148837",   # polis
    "Q14616455",  # destroyed city
    "Q109607",   # ruins
    "Q755017",   # tell
    "Q756780",   # Roman colony
    "Q15217609",  # titular see (ancient bishoprics)
}
have_qids = {p["qid"] for p in places if "qid" in p}
for w in wd_settlements:
    if w["startYear"] > ATLAS_END:
        continue
    if w["startYear"] == 0:
        died_in_window = 0 < w["endYear"] <= ATLAS_END
        ancient = WD_ANCIENT_TYPES.intersection(w.get("types") or ())
        if not died_in_window and not ancient:
            stats["wd dropped (unknown start, modern type)"] += 1
            continue
    if w["qid"] in have_qids:
        stats["wd skipped (qid already on a node)"] += 1
        continue
    places.append({
        "id": f"wd-{w['qid']}",
        "name": w["name"],
        "lat": w["lat"],
        "lng": w["lng"],
        "startYear": w["startYear"],
        "endYear": w["endYear"],
        "qid": w["qid"],
        "minor": True,
    })
    have_qids.add(w["qid"])
    stats["wd nodes"] += 1

# second vici pass: links that found no pid/dare key can still join via
# vici.org's own wikidata identity — now that qid-bearing wd nodes exist
node_by_qid = {}
for p in places:
    if "qid" in p and p["qid"] not in node_by_qid:
        node_by_qid[p["qid"]] = p
for vid, link in xw_vici.items():
    if vid in vici_attached:
        continue
    v = vici_by_id.get(vid)
    q = link.get("qid")
    if v is None or not q or q not in node_by_qid:
        continue
    node = node_by_qid[q]
    node.setdefault("vici", []).append(vid)
    if (v.get("siteType") or "").lower() in SETTLEMENT_KINDS:
        vici_merged.append(vid)
    stats["vici attached via qid"] += 1

# --- absorb the curated narrative graph: 15 location entities -> nodes ---
# The original "Hidden Network" locations attach to their canonical node, so
# clicking a place on the map can open its hand-written connection graph.
import math
def km(a, b):
    (la1, lo1), (la2, lo2) = a, b
    p1, p2 = math.radians(la1), math.radians(la2)
    dp, dl = math.radians(la2 - la1), math.radians(lo2 - lo1)
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * 6371 * math.asin(min(1, math.sqrt(h)))

ENTITY_ALIASES = {"massilia": "massalia", "syracuse": "syracusae", "londinium": "londinium"}
locs = json.load(open(os.path.join(BASE, "entities", "locations.json")))
conns = json.load(open(os.path.join(BASE, "entities", "connections.json")))
conn_count = defaultdict(int)
for cx in conns:
    conn_count[cx["source"]] += 1
    conn_count[cx["target"]] += 1

print("entity -> node absorption (audit):")
for lo in locs:
    c = lo.get("coordinates")
    if not c:
        continue
    lname = lo["name"].lower()
    lname = ENTITY_ALIASES.get(lname, lname)
    best, score = None, (-1, -1e9)
    for p in places:
        d = km((c["lat"], c["lng"]), (p["lat"], p["lng"]))
        if d > 25:
            continue
        namehit = lname in p["name"].lower() or p["name"].lower() in lname
        sc = (namehit * 4 + ("populations" in p) * 2 + (p.get("dare", {}).get("major", False) * 1), -d)
        if sc > score:
            best, score = p, sc
    if best is None:
        print(f"  {lo['id']:16} -> NO NODE within 25 km ⚠")
        continue
    best["entity"] = lo["id"]
    n = conn_count.get(lo["id"], 0)
    if n:
        best["entityConnections"] = n
    print(f"  {lo['id']:16} -> {best['id']:14} {best['name']:20} ({-score[1]:.1f} km, {n} connections)")

mpath = os.path.join(R, "vici-merged.json")
dump_atomic(sorted(vici_merged), mpath, separators=(",", ":"))
open(mpath, "a").write("\n")
print(f"vici-merged.json: {len(vici_merged)} settlement-kind vici points now represented by nodes")

# --- geographic context (idea credit: session B, 2026-07-06) ---
# Every non-major node learns its nearest major city: "42 km NE of
# Londinium". Pure geometry, zero external data — turns stub places into
# located places.
import math as _math
majors = [p for p in places if p.get("populations")]
mgrid = defaultdict(list)
for m in majors:
    mgrid[(int(m["lat"] // 2), int(m["lng"] // 2))].append(m)

def bearing8(dlat, dlng, coslat):
    ang = (_math.degrees(_math.atan2(dlng * coslat, dlat)) + 360) % 360
    return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][int((ang + 22.5) // 45) % 8]

near_n = 0
for p in places:
    if p.get("populations"):
        continue
    gy, gx = int(p["lat"] // 2), int(p["lng"] // 2)
    best, bd = None, 300.0
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            for m in mgrid.get((gy + dy, gx + dx), []):
                d = km((p["lat"], p["lng"]), (m["lat"], m["lng"]))
                if d < bd:
                    best, bd = m, d
    if best and bd >= 2:
        coslat = _math.cos(_math.radians(p["lat"]))
        b = bearing8(p["lat"] - best["lat"], p["lng"] - best["lng"], coslat)
        p["near"] = [best["name"], round(bd), b]
        near_n += 1
print(f"geographic context: {near_n} nodes located relative to a major city")

places.sort(key=lambda p: p["id"])
out = os.path.join(BASE, "places")
os.makedirs(out, exist_ok=True)
path = os.path.join(out, "places.json")
dump_atomic(places, path, ensure_ascii=False, separators=(",", ":"))
open(path, "a").write("\n")

# --- zoom tiers: the DEFAULT view renders ~1,700 of these 32k nodes ---
# core = everything visible at empire zooms (population nodes + DARE
# majors/types 11+17); detail = minors/gazetteer, first renderable at
# zoom 7-8 — streamed in the background after core paints. Mirror of
# PlacesLayer.getZoomThreshold; keep in sync.
core, detail = [], []
for p in places:
    t = (p.get("dare") or {}).get("type")
    if p.get("populations") or (
        t is not None and (p.get("dare", {}).get("major") or t in (11, 17))
    ):
        core.append(p)
    else:
        detail.append(p)
for tier_name, tier in (("places-core", core), ("places-detail", detail)):
    tp = os.path.join(out, f"{tier_name}.json")
    dump_atomic(tier, tp, ensure_ascii=False, separators=(",", ":"))
    open(tp, "a").write("\n")
    print(f"{tier_name}.json: {len(tier)} nodes, {os.path.getsize(tp)//1024} KB")

print(f"places.json: {len(places)} canonical nodes ({os.path.getsize(path)//1024//1024}.{os.path.getsize(path)//1024%1024//103} MB)")
print(f"  from {len(dare)} DARE + {sum(1 for c in chandler if c['startYear']<=MAX_YEAR)} Chandler records")
for k in ("merged dare+chandler", "multi-dare collapsed", "with pid", "with qid", "with wiki"):
    print(f"  {k}: {stats[k]}")

# --- gold checks ---
def find(n):
    cands = [p for p in places if p["name"] == n]
    return sorted(cands, key=lambda p: -(max((x["population"] for x in p.get("populations", [])), default=0)))[0] if cands else None
for n in ("Rome", "Constantinople", "Alexandria", "Carthage"):
    p = find(n)
    if p:
        print(f"  GOLD {n:15} id={p['id']:12} qid={p.get('qid')} pop={'yes' if 'populations' in p else 'no'} "
              f"dare={'yes' if 'dare' in p else 'no'} wiki={p.get('wiki', ['-'])[0]} span={p['startYear']}..{p['endYear']}")
    else:
        print(f"  GOLD {n}: MISSING")
# duplicate-name Rome nodes? (should be ONE renderable major Rome)
romes = [p for p in places if p["name"] == "Rome"]
print(f"  nodes named 'Rome': {len(romes)}")
