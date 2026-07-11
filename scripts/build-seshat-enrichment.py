#!/usr/bin/env python3
"""
Join Seshat Databank polity attributes (capitals, scholarly descriptions) to
Cliopatria empire shapes, keyed by polity NAME — not QID: Cliopatria reuses
one QID across related polities (Roman Empire and Eastern Roman Empire are
both Q12544; 85 QIDs collide that way), while Name is the identity our
shapes carry verbatim.

Join chain: Cliopatria feature Name -> SeshatID(s) (semicolon-split; present
on 755/1633 polities) -> seshat-db.com/api/core/polities `name` (verified
100% match for all 561 distinct codes) -> capitals via
/api/general/polity-capitals.

Sources (fetched 2026-07-11, no auth needed):
  https://seshat-db.com/api/core/polities/?page_size=100 (paginated)
  https://seshat-db.com/api/general/polity-capitals/?page_size=100
staged at /private/tmp/seshat_polities.json + seshat_capitals.json;
Cliopatria at /private/tmp/cliopatria_polities_only.geojson.

Output: src/data/empires/seshat.json  { polityName: {sid, c?, cl?, d?} }
  sid = Seshat polity code, c = capital name(s), cl = [lat, lng] of first
  capital, d = general_description with §REF§...§REF§ citations stripped.
License: Seshat Databank CC BY (Zenodo release; attribution in About).
"""
import json, os, re
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic

CLIO = "/private/tmp/cliopatria_polities_only.geojson"
POLITIES = "/private/tmp/seshat_polities.json"
CAPITALS = "/private/tmp/seshat_capitals.json"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "data", "empires", "seshat.json")

REF = re.compile(r"§REF§.*?§REF§", re.S)
MAX_DESC = 1500  # panel prose cap — cut at a sentence boundary

def clean_desc(t):
    t = REF.sub("", t or "")
    t = re.sub(r"\s+", " ", t).strip()
    if len(t) > MAX_DESC:
        cut = t.rfind(". ", 0, MAX_DESC)
        t = t[: cut + 1] if cut > 200 else t[:MAX_DESC]
    return t or None

# Cliopatria: polity Name -> SeshatIDs
name_sids = {}
for f in json.load(open(CLIO))["features"]:
    p = f["properties"]
    n = p["Name"].strip()
    for sid in (p.get("SeshatID") or "").split(";"):
        if sid.strip():
            name_sids.setdefault(n, set()).add(sid.strip())

polity_by_code = {p["name"]: p for p in json.load(open(POLITIES))}

caps_by_code = {}
for row in json.load(open(CAPITALS)):
    code = (row.get("polity") or {}).get("name")
    cap = row.get("polity_cap") or {}
    cap_name = row.get("capital") or cap.get("name")
    if cap_name and cap_name.strip().lower() in ("none", "unknown"):
        continue  # the API encodes "no known capital" as the string "None"
    if code and cap_name:
        caps_by_code.setdefault(code, []).append({
            "name": row.get("capital") or cap.get("name"),
            "lat": float(cap["latitude"]) if cap.get("latitude") else None,
            "lng": float(cap["longitude"]) if cap.get("longitude") else None,
        })

out = {}
for name, sids in sorted(name_sids.items()):
    if name.startswith("("):  # "(Alliance …)" meta-records, dropped at ingest
        continue
    hits = [polity_by_code[s] for s in sorted(sids) if s in polity_by_code]
    if not hits:
        continue
    # several codes can back one shape (RELATION rows) — richest prose wins
    best = max(hits, key=lambda p: len(p.get("general_description") or ""))
    rec = {"sid": best["name"]}
    d = clean_desc(best.get("general_description"))
    if d:
        rec["d"] = d
    caps = []
    for h in hits:
        caps += caps_by_code.get(h["name"], [])
    seen = set()
    caps = [c for c in caps if not (c["name"] in seen or seen.add(c["name"]))]
    if caps:
        rec["c"] = " · ".join(c["name"] for c in caps[:3])
        first = next((c for c in caps if c["lat"] is not None), None)
        if first:
            rec["cl"] = [round(first["lat"], 3), round(first["lng"], 3)]
    out[name] = rec

dump_atomic(out, OUT, ensure_ascii=False, separators=(",", ":"))
open(OUT, "a").write("\n")
withd = sum(1 for r in out.values() if "d" in r)
withc = sum(1 for r in out.values() if "c" in r)
print(f"seshat.json: {len(out)} polities, {withd} with description, "
      f"{withc} with capital, {os.path.getsize(OUT)//1024} KB")
for probe in ("Sasanian Empire", "Abbasid Caliphate", "Eastern Roman Empire"):
    print(f"  {probe}: {json.dumps(out.get(probe), ensure_ascii=False)[:140]}")
