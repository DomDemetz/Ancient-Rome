#!/usr/bin/env python3
"""
Normalize qid fields in unified chunks. Some enrichment passes wrote
polluted values ("Q123: Some Label", "Name (Q123)"); a QID field holds a
QID, nothing else. Extracts the first Q\\d+; unmatchable values move to
props.qidRaw for forensics. Runs in build-data after chunk generation so
regeneration can't reintroduce the pattern (schema gate enforces).
"""
import glob, json, os, re

fixed = moved = 0
for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__), "..", "src", "data", "unified", "*.json"))):
    d = json.load(open(f))
    dirty = False
    for e in d:
        q = e.get("qid")
        if q is None or (isinstance(q, str) and re.fullmatch(r"Q\d+", q)):
            continue
        m = re.search(r"Q\d+", str(q))
        if m:
            e["qid"] = m.group(0)
            fixed += 1
        else:
            e.setdefault("props", {})["qidRaw"] = q
            e["qid"] = None
            moved += 1
        dirty = True
    if dirty:
        json.dump(d, open(f, "w"), ensure_ascii=False, separators=(",", ":"))
        open(f, "a").write("\n")
print(f"qids normalized: {fixed} extracted, {moved} moved to props.qidRaw")
