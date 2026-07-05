#!/usr/bin/env python3
"""
Extract Vici.org's NATIVE per-point identity from the SQL dump's pmetadata
table (pmeta_pleiades, pmeta_dare, wikidata=Q… inside pmeta_extids) into
registry/crosswalk-vici.json — {viciId: {pid?, dare?, qid?}}.

This is curated truth from vici.org itself; no fuzzy matching involved.
Requires /private/tmp/vici.sql.gz. Idempotent.
"""
import gzip, json, os, re

BASE = os.path.join(os.path.dirname(__file__), "..", "src", "data")
DUMP = "/private/tmp/vici.sql.gz"

def parse_tuples(line):
    """Yield value-lists from a MySQL INSERT line (handles quoted strings)."""
    i = line.index("VALUES") + 6
    n = len(line)
    while i < n:
        while i < n and line[i] != "(":
            i += 1
        if i >= n:
            return
        i += 1
        vals, cur, in_str = [], [], False
        while i < n:
            ch = line[i]
            if in_str:
                if ch == "\\" and i + 1 < n:
                    cur.append(line[i + 1]); i += 2; continue
                if ch == "'":
                    if i + 1 < n and line[i + 1] == "'":
                        cur.append("'"); i += 2; continue
                    in_str = False; i += 1; continue
                cur.append(ch); i += 1; continue
            if ch == "'":
                in_str = True; i += 1; continue
            if ch == ",":
                vals.append("".join(cur)); cur = []; i += 1; continue
            if ch == ")":
                vals.append("".join(cur)); i += 1
                yield vals
                break
            cur.append(ch); i += 1

# our flattened vici ids
have = {v.get("properties", v)["id"] for v in json.load(open(os.path.join(BASE, "vici-sites.json")))}

out = {}
stats = {"pleiades": 0, "dare": 0, "qid": 0}
for line in gzip.open(DUMP, "rt", encoding="utf-8", errors="replace"):
    if not line.startswith("INSERT INTO `pmetadata`"):
        continue
    for v in parse_tuples(line):
        if len(v) < 15:
            continue
        pnt = v[1].strip()
        vid = f"vici-{pnt}"
        if vid not in have:
            continue
        entry = {}
        pleiades = v[10].strip()
        dare = v[13].strip()
        extids = v[9]
        if pleiades not in ("", "NULL", "0"):
            entry["pid"] = pleiades; stats["pleiades"] += 1
        if dare not in ("", "NULL", "0"):
            entry["dare"] = dare; stats["dare"] += 1
        m = re.search(r"wikidata=(Q\d+)", extids or "")
        if m:
            entry["qid"] = m.group(1); stats["qid"] += 1
        if entry:
            out[vid] = entry

path = os.path.join(BASE, "registry", "crosswalk-vici.json")
json.dump(out, open(path, "w"), separators=(",", ":"), sort_keys=True)
open(path, "a").write("\n")
print(f"crosswalk-vici.json: {len(out)} vici points with native identity "
      f"(pleiades {stats['pleiades']}, dare {stats['dare']}, wikidata {stats['qid']}) "
      f"— {os.path.getsize(path)//1024} KB")
