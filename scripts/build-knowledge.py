#!/usr/bin/env python3
"""
P0 KNOWLEDGE CONSOLIDATION — one store, keyed by the graph.

Today knowledge lives in ~10 files keyed by layer-specific ids
(settlements-wiki by DARE id, battles-wiki by battle id, cross-reference
by "type:id"...) — every layer resolves content its own way (the
"five-layer cascade"). This build step consolidates all of it into
graph-keyed stores:

  knowledge/places.json   key = canonical node id  (node's wiki ref +
                          cross-ref via dare/pleiades key + qid)
  knowledge/features.json key = unified entity id  (per-type wiki files +
                          cross-ref; node-linked entities NOT duplicated —
                          consumers fall through entity → its node)
  knowledge/other.json    key = emperor:<id> | legion:<id> | entity:<id>

Entry shape (superset of WikiEnrichment, plus provenance):
  { extract, thumbnail?, wikipediaUrl?, wikidataUrl?, qid?,
    crossRef?, sources: ["settlements-wiki", "cross-reference", ...] }

Additive: legacy wiki/* files stay until UI adoption completes (board).
"""
import json, os
from collections import defaultdict

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")
W = lambda n: json.load(open(os.path.join(BASE, "wiki", n)))

places = json.load(open(os.path.join(BASE, "places", "places.json")))
setl = W("settlements-wiki.json")
cross = W("cross-reference.json")
try:
    wd_wiki = W("wd-wiki.json")  # Wikidata settlement extracts (node-id keyed)
except FileNotFoundError:
    wd_wiki = {}

def base_entry(wiki, src):
    e = {k: wiki[k] for k in ("extract", "romanEraExtract", "wikiTitle", "wikipediaUrl",
                              "wikidataUrl", "wikidataId", "thumbnail", "description",
                              "descriptionSource", "romanRelevance", "wrongArticle")
         if wiki.get(k) is not None}
    e["sources"] = [src]
    return e

# ---- places.json store (node-keyed) ----
k_places = {}
for p in places:
    entry = None
    ref = p.get("wiki")
    if ref and ref[0] == "settlements" and ref[1] in setl:
        entry = base_entry(setl[ref[1]], "settlements-wiki")
    elif p["id"] in wd_wiki and wd_wiki[p["id"]].get("extract"):
        entry = base_entry(wd_wiki[p["id"]], "wd-wiki")
    # cross-ref by settlement / pleiades keys
    cr = None
    if p.get("dare"):
        cr = cross.get(f"settlement:{p['dare']['id']}")
    if cr is None and p.get("pid"):
        cr = cross.get(f"pleiades:{p['pid']}")
    if cr:
        entry = entry or {"sources": []}
        entry["crossRef"] = cr
        entry["sources"].append("cross-reference")
    if p.get("qid"):
        entry = entry or {"sources": []}
        entry["qid"] = p["qid"]
    if entry and (entry.get("extract") or entry.get("crossRef")):
        k_places[p["id"]] = entry

# ---- features store (unified-entity-keyed) ----
join = json.load(open(os.path.join(BASE, "registry", "unified-nodes.json")))
TYPE_WIKI = {
    "battle": ("battles-wiki.json", "battle"),
    "amphitheater": ("amphitheaters-wiki.json", "amphitheater"),
    "building": ("buildings-wiki.json", "building"),
    "aqueduct": ("aqueducts-wiki.json", "aqueduct"),
    "port": ("ports-wiki.json", "port"),
}
k_feat = {}
import glob
for path in sorted(glob.glob(os.path.join(BASE, "unified", "*.json"))):
    tname = os.path.basename(path)[:-5]
    wiki_file = TYPE_WIKI.get(tname)
    wlookup = W(wiki_file[0]) if wiki_file else {}
    crprefix = wiki_file[1] if wiki_file else tname
    for e in json.load(open(path)):
        uid = e["id"]
        bare = uid.split(":", 1)[1] if ":" in uid else uid
        entry = None
        if bare in wlookup:
            entry = base_entry(wlookup[bare], wiki_file[0][:-5])
        cr = cross.get(f"{crprefix}:{bare}") or cross.get(uid)
        if cr:
            entry = entry or {"sources": []}
            entry["crossRef"] = cr
            entry["sources"].append("cross-reference")
        if entry:
            if uid in join:
                entry["node"] = join[uid]["node"]
            k_feat[uid] = entry

# ---- other (emperors, legions, narrative entities) ----
k_other = {}
for fname, prefix in [("emperors-wiki.json", "emperor"), ("legions-wiki.json", "legion"),
                      ("entities-wiki.json", "entity")]:
    for k, v in W(fname).items():
        k_other[f"{prefix}:{k}"] = base_entry(v, fname[:-5])

# Merge with previous builds: preserve fetched content (extracts,
# thumbnails, wiki URLs) that isn't derivable from wiki source files.
node_ids = {p["id"] for p in places}
for name, store in [("places", k_places), ("features", k_feat)]:
    # for places, the full-fidelity previous build lives in places-detail
    # (places.json itself is the slim tier from here on)
    prev_name = "places-detail" if name == "places" else name
    prev_path = os.path.join(BASE, "knowledge", f"{prev_name}.json")
    if name == "places" and not os.path.exists(prev_path):
        prev_path = os.path.join(BASE, "knowledge", "places.json")
    if os.path.exists(prev_path):
        prev = json.load(open(prev_path))
        preserved = 0
        merged = 0
        for k, v in prev.items():
            if k not in store:
                # never resurrect an entry whose canonical node is gone —
                # preservation kept 482 ghost-town extracts alive after
                # their nodes were dropped by the zero-start gate
                if name == "places" and k not in node_ids:
                    continue
                if v.get("extract") or v.get("wikipediaUrl"):
                    store[k] = v
                    preserved += 1
            else:
                # Merge fetched fields into rebuilt entries
                for field in ("extract", "thumbnail", "wikipediaUrl"):
                    if v.get(field) and not store[k].get(field):
                        store[k][field] = v[field]
                        merged += 1
        if preserved:
            print(f"  {name}: preserved {preserved} enriched entries not in build sources")
        if merged:
            print(f"  {name}: merged {merged} fetched fields into rebuilt entries")

# ---- two-tier places store ----
# The popup path renders: extract/romanEraExtract, thumbnail, and a
# handful of crossRef fields (FIRST SENTENCE of the descriptions only —
# see appendCrossRefTooltip). Shipping the full Pleiades/Wikidata record
# for all ~29k entries made knowledge/places.json a 10 MB download on
# the DEFAULT view. places.json is now the slim popup tier;
# places-detail.json keeps full entries and loads only when the detail
# panel opens (useWikiEnrichment 'knowledge-places-detail').
import re as _re

def first_sentence(t):
    if not t:
        return t
    m = _re.match(r"^(.+?\.)\s+(?=[A-Z])", t)
    return m.group(1) if m else t

POPUP_CR = ("imageUrl", "province", "tradeRole", "ancientAuthors", "sources",
            "ancientTextMentions", "capacity", "outcome", "combatants", "buildingType")
k_places_detail = k_places
k_places_slim = {}
for k, v in k_places.items():
    # top-level `sources` is build provenance — nothing at runtime reads it
    e = {f: v[f] for f in v if f not in ("crossRef", "sources")}
    cr = v.get("crossRef")
    if cr:
        slim = {f: cr[f] for f in POPUP_CR if cr.get(f) is not None}
        for df in ("pleiadesDescription", "wikidataDescription", "description"):
            if cr.get(df):
                slim[df] = first_sentence(cr[df])
        e["crossRef"] = slim
    k_places_slim[k] = e

out_dir = os.path.join(BASE, "knowledge")
os.makedirs(out_dir, exist_ok=True)
for name, store in [("places", k_places_slim), ("places-detail", k_places_detail),
                    ("features", k_feat), ("other", k_other)]:
    p = os.path.join(out_dir, f"{name}.json")
    json.dump(store, open(p, "w"), ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    open(p, "a").write("\n")
    print(f"knowledge/{name}.json: {len(store)} entries, {os.path.getsize(p)//1024} KB")
print("consolidated from", len(setl), "settlement +", len(cross), "cross-ref +",
      "per-type wiki files — legacy files remain until UI adoption")
