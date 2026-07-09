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
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic


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
unified_ids = set()
import glob
for path in sorted(glob.glob(os.path.join(BASE, "unified", "*.json"))):
    tname = os.path.basename(path)[:-5]
    wiki_file = TYPE_WIKI.get(tname)
    wlookup = W(wiki_file[0]) if wiki_file else {}
    crprefix = wiki_file[1] if wiki_file else tname
    for e in json.load(open(path)):
        uid = e["id"]
        unified_ids.add(uid)
        bare = uid.split(":", 1)[1] if ":" in uid else uid
        entry = None
        if bare in wlookup:
            entry = base_entry(wlookup[bare], wiki_file[0][:-5])
        cr = cross.get(f"{crprefix}:{bare}") or cross.get(uid)
        if cr:
            entry = entry or {"sources": []}
            entry["crossRef"] = cr
            entry["sources"].append("cross-reference")
        # resolve `description` at BUILD time (port of mergeStructuredData's
        # runtime pass) so map layers can read the features store directly
        # instead of dragging the 14 MB cross-reference into a live merge
        if entry:
            rex, ex = entry.get("romanEraExtract"), entry.get("extract")
            is_custom = bool(rex and ex and ex[:80] != rex[:80])
            pleiades = (cr or {}).get("pleiadesDescription")
            if is_custom:
                entry["description"], entry["descriptionSource"] = rex, "custom"
            elif pleiades:
                entry["description"], entry["descriptionSource"] = pleiades, "pleiades"
            elif rex or ex:
                entry["description"], entry["descriptionSource"] = rex or ex, "generic"
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
    prev_name = f"{name}-detail"
    prev_path = os.path.join(BASE, "knowledge", f"{prev_name}.json")
    if not os.path.exists(prev_path):
        prev_path = os.path.join(BASE, "knowledge", f"{name}.json")
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
                if name == "features" and k not in unified_ids:
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
            "ancientTextMentions", "capacity", "outcome", "combatants", "buildingType",
            "containedInQid", "wikiUrl", "label")
def slim_store(store):
    out = {}
    for k, v in store.items():
        # top-level `sources` is build provenance — nothing at runtime reads it
        e = {f: v[f] for f in v if f not in ("crossRef", "sources")}
        cr = v.get("crossRef")
        if cr:
            slim = {f: cr[f] for f in POPUP_CR if cr.get(f) is not None}
            for df in ("pleiadesDescription", "wikidataDescription", "description"):
                if cr.get(df):
                    slim[df] = first_sentence(cr[df])
            e["crossRef"] = slim
        out[k] = e
    return out

out_dir = os.path.join(BASE, "knowledge")
os.makedirs(out_dir, exist_ok=True)

# popup tier splits again by NODE zoom tier: the default view mounts
# PlacesLayer and only ~1,700 core nodes can even render there — their
# knowledge is a few hundred KB; the minor-node knowledge streams with
# the places detail tier. (places.json stays emitted for tests/tooling.)
places_slim = slim_store(k_places)
core_ids = {p["id"] for p in json.load(open(os.path.join(BASE, "places", "places-core.json")))}
slim_core = {k: v for k, v in places_slim.items() if k in core_ids}
slim_minor = {k: v for k, v in places_slim.items() if k not in core_ids}

for name, store in [("places", places_slim), ("places-core", slim_core),
                    ("places-minor", slim_minor), ("places-detail", k_places),
                    ("features", slim_store(k_feat)), ("features-detail", k_feat),
                    ("other", k_other)]:
    p = os.path.join(out_dir, f"{name}.json")
    dump_atomic(store, p, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    open(p, "a").write("\n")
    print(f"knowledge/{name}.json: {len(store)} entries, {os.path.getsize(p)//1024} KB")
print("consolidated from", len(setl), "settlement +", len(cross), "cross-ref +",
      "per-type wiki files — legacy files remain until UI adoption")
