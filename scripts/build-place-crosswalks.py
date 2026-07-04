#!/usr/bin/env python3
"""
Build crosswalks from DARE settlements and Chandler cities onto the Pleiades
spine (canonical place = Pleiades ID, Wikidata QID via the P1584 bridge).

Matching is pairwise best-match (no transitive chaining): a record links to the
single nearest Pleiades place sharing any name variant within a tight radius.
Name variants: DARE name/modern/greek, Pleiades name, and the Wikidata English
label from the bridge — which supplies the Latin↔English aliases (Roma↔Rome)
that exact-name matching misses.

Outputs (additive; nothing else touched):
  src/data/registry/crosswalk-dare.json      {dareId: {pid, qid?, km, via}}
  src/data/registry/crosswalk-chandler.json  {chandlerId: {...}}
"""
import json, math, os, re, unicodedata
from collections import defaultdict

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")

def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def km(a, b):
    (la1, lo1), (la2, lo2) = a, b
    p1, p2 = math.radians(la1), math.radians(la2)
    dp, dl = math.radians(la2 - la1), math.radians(lo2 - lo1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371 * math.asin(min(1, math.sqrt(h)))


# Well-known English exonyms -> classical names. Bounded, curated, documented:
# these are the handful of famous places whose English name appears in no
# source field (DARE uses native modern names, Pleiades uses ancient ones).
EXONYMS = {
    "athens": "athenae", "antioch": "antiochia", "cordoba": "corduba",
    "seville": "hispalis", "lisbon": "olisipo", "milan": "mediolanum",
    "naples": "neapolis", "marseille": "massalia", "lyon": "lugdunum",
    "genoa": "genua", "florence": "florentia", "venice": "venetiae",
    "damascus": "damascus", "aleppo": "beroea", "trier": "augusta treverorum",
}

def expand(variants):
    return variants | {EXONYMS[v] for v in variants if v in EXONYMS}

pleiades = json.load(open(os.path.join(BASE, "pleiades-all.json")))
bridge = json.load(open(os.path.join(BASE, "registry", "pleiades-wikidata.json")))

# spine index: grid -> [(pid, lat, lng, variants)]
grid = defaultdict(list)
spine = {}
for p in pleiades:
    pr = p.get("properties", p)
    pid = str(pr.get("id"))
    try:
        lat, lng = float(pr["lat"]), float(pr["lng"])
    except (KeyError, TypeError, ValueError):
        continue
    vs = {norm(seg) for seg in str(pr.get("name", "")).split("/")} - {""}
    if pid in bridge:
        vs |= {norm(bridge[pid]["label"])} - {""}
    pt = str(pr.get("placeType", "")).lower()
    major = any(k in pt for k in ("settlement", "urban", "city", "polis"))
    spine[pid] = (lat, lng, vs, major)
    grid[(round(lat * 4), round(lng * 4))].append(pid)

def best(lat, lng, variants, radius):
    cands = []
    gy, gx = round(lat * 4), round(lng * 4)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            cands += grid.get((gy + dy, gx + dx), [])
    hit, hd, hmaj = None, radius, False
    for pid in cands:
        plat, plng, pvs, major = spine[pid]
        if variants & pvs:
            d = km((lat, lng), (plat, plng))
            if d <= radius and (major, -d) > (hmaj, -hd):
                # prefer settlement-type places over minor same-name features
                hit, hd, hmaj = pid, d, major
    return hit, hd, hmaj

def crosswalk(records, get, radius, outname):
    out, stats = {}, defaultdict(int)
    for r in records:
        rid, lat, lng, variants = get(r)
        if lat is None:
            continue
        pid, d, major = best(lat, lng, variants, radius)
        if pid:
            entry = {"pid": pid, "km": round(d, 1), "major": major}
            if pid in bridge:
                entry["qid"] = bridge[pid]["qid"]
                stats["with_qid"] += 1
            out[rid] = entry
            stats["matched"] += 1
        stats["total"] += 1
    path = os.path.join(BASE, "registry", outname)
    json.dump(out, open(path, "w"), ensure_ascii=False, indent=1, sort_keys=True)
    open(path, "a").write("\n")
    print(f"{outname}: {stats['matched']}/{stats['total']} matched ({100*stats['matched']//max(1,stats['total'])}%), "
          f"{stats['with_qid']} also carry a QID  ({os.path.getsize(path)//1024} KB)")

dare = json.load(open(os.path.join(BASE, "dare", "settlements.json")))
crosswalk(dare, lambda s: (str(s["id"]), s.get("lat"), s.get("lng"),
          {norm(seg) for f in ("name","modern","greek") for seg in str(s.get(f,"")).split("/")} - {""}), 10.0, "crosswalk-dare.json")

chandler = json.load(open(os.path.join(BASE, "cities", "historical-cities.json")))
crosswalk(chandler, lambda c: (c["id"], c.get("lat"), c.get("lng"), expand({norm(c.get("name",""))} - {""})), 25.0, "crosswalk-chandler.json")


# --- Two-hop pass: Chandler speaks modern names; DARE carries them. ---
# chandler --(name==dare.name|modern, <=25km)--> dare record --(crosswalk)--> pid
xw_dare = json.load(open(os.path.join(BASE, "registry", "crosswalk-dare.json")))
dgrid = defaultdict(list)
for i, s in enumerate(dare):
    try:
        dgrid[(round(float(s["lat"]) * 4), round(float(s["lng"]) * 4))].append(i)
    except (KeyError, TypeError, ValueError):
        pass

xw_ch_path = os.path.join(BASE, "registry", "crosswalk-chandler.json")
xw_ch = json.load(open(xw_ch_path))
added = 0
for c in chandler:
    prior = xw_ch.get(c["id"])
    if prior and prior.get("major", True):
        continue  # keep confident settlement-type direct matches
    cv = {norm(c.get("name", ""))} - {""}
    best_pid, best_d = None, 25.0
    gy, gx = round(c["lat"] * 4), round(c["lng"] * 4)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            for i in dgrid.get((gy + dy, gx + dx), []):
                s = dare[i]
                sv = {norm(s.get("name", "")), norm(s.get("modern", ""))} - {""}
                if cv & sv and str(s["id"]) in xw_dare:
                    d = km((c["lat"], c["lng"]), (float(s["lat"]), float(s["lng"])))
                    if d <= best_d:
                        best_pid, best_d = xw_dare[str(s["id"])]["pid"], d
    if best_pid:
        entry = {"pid": best_pid, "km": round(best_d, 1), "via": "dare-modern-name", "major": True}
        if best_pid in bridge:
            entry["qid"] = bridge[best_pid]["qid"]
        xw_ch[c["id"]] = entry
        added += 1
json.dump(xw_ch, open(xw_ch_path, "w"), ensure_ascii=False, indent=1, sort_keys=True)
open(xw_ch_path, "a").write("\n")
print(f"two-hop pass: +{added} chandler links -> total {len(xw_ch)}/{len(chandler)} ({100*len(xw_ch)//len(chandler)}%)")
