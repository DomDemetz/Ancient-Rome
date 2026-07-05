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
import json, os
from collections import defaultdict

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
cities_wiki = json.load(open(os.path.join(BASE, "wiki", "cities-wiki.json")))

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

    # name: Chandler (curated display) > DARE > Pleiades
    name = (c and c["name"]) or (d and d["name"]) or (pl and pl.get("name")) or "?"

    # lifespan: widest attested span; keep DARE's 0 = unknown semantics only
    # when no source gives a real bound
    starts = [v for v in ([d.get("startYear") if d else None, c["startYear"] if c else None]) if v not in (None, 0)]
    ends = [v for v in ([d.get("endYear") if d else None, c["endYear"] if c else None]) if v not in (None, 0)]
    start = min(starts) if starts else 0
    end = max(ends) if ends else 0

    qid = (d and dare_qid.get(str(d["id"]))) or (pid and bridge.get(pid, {}).get("qid")) \
          or (c and xw_ch.get(c["id"], {}).get("qid")) or None

    # knowledge ref: prefer the settlements enrichment (richer, cross-ref'd)
    wiki = None
    if d and str(d["id"]) in setl_wiki:
        wiki = ["settlements", str(d["id"])]
    elif c and c["id"] in cities_wiki:
        wiki = ["cities", c["id"]]

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

places.sort(key=lambda p: p["id"])
out = os.path.join(BASE, "places")
os.makedirs(out, exist_ok=True)
path = os.path.join(out, "places.json")
json.dump(places, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
open(path, "a").write("\n")

print(f"places.json: {stats['nodes']} canonical nodes ({os.path.getsize(path)//1024//1024}.{os.path.getsize(path)//1024%1024//103} MB)")
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
