#!/usr/bin/env python3
"""Data-quality validation over the entity files that feed the UI.

Mechanical, deterministic rules — no network, no heuristic scoring.
Exit code 1 if any ERROR-severity rule fires (CI gate); WARN rules report only.

Usage:
    python3 scripts/validate-entities.py            # human summary
    python3 scripts/validate-entities.py --json out.json   # full report
    python3 scripts/validate-entities.py --ci       # ratchet gate: fail only
                                                    # if a rule count exceeds
                                                    # scripts/validation-baseline.json
    python3 scripts/validate-entities.py --update-baseline # rewrite baseline
                                                    # after intentional fixes
"""

import json
import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'lib'))
from atomic_json import dump_atomic


DATA = Path(__file__).resolve().parent.parent / "src" / "data"

# Bounds of the plausible historical window for this atlas
YEAR_MIN, YEAR_MAX = -10000, 1500

# Description phrases that mark a Pleiades "building" as actually a
# settlement/site record swept in by the substring type-matcher
SITE_PHRASES = re.compile(
    r"\b(settlement|tell |tell,|village|town of|city of|archaeological site|"
    r"multi-period|occupation|necropolis|cemetery)\b",
    re.I,
)
VILLA_PHRASES = re.compile(r"\bvilla\b", re.I)


def norm_name(s):
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    return s


class Report:
    def __init__(self):
        self.findings = defaultdict(list)  # rule -> [examples]
        self.counts = Counter()
        self.severity = {}

    def add(self, rule, severity, key, detail):
        self.counts[rule] += 1
        self.severity[rule] = severity
        if len(self.findings[rule]) < 25:
            self.findings[rule].append({"key": key, "detail": detail})


def check_cross_reference(rep):
    cr = json.load(open(DATA / "wiki" / "cross-reference.json"))
    qid_keys = defaultdict(list)

    for key, e in cr.items():
        wd = e.get("wdProps") or {}
        start, end = e.get("startYear"), e.get("endYear")
        inception, dissolved = wd.get("inception"), wd.get("dissolved")

        if e.get("qid"):
            qid_keys[e["qid"]].append(key)

        # A1: end before start
        if start not in (None, 0) and end not in (None, 0) and end < start:
            rep.add("end-before-start", "ERROR", key, f"start={start} end={end}")

        # A2: wikidata dissolved before inception
        if inception is not None and dissolved is not None and dissolved < inception:
            rep.add("dissolved-before-inception", "ERROR", key,
                    f"inception={inception} dissolved={dissolved}")

        # A3: displayed date pair incoherent — the panel shows startYear as
        # Built/Founded and wd.dissolved as Dissolved; flag dissolved < start
        if start not in (None, 0) and dissolved is not None and dissolved < start:
            rep.add("displayed-dissolved-before-built", "ERROR", key,
                    f"startYear={start} wd.dissolved={dissolved}")

        # A4: startYear vs wikidata inception disagree by > 200y
        if start not in (None, 0) and inception is not None and abs(start - inception) > 200:
            rep.add("start-vs-inception-conflict", "WARN", key,
                    f"startYear={start} wd.inception={inception}")

        # B1: years outside plausible window
        for label, y in (("startYear", start), ("endYear", end),
                         ("inception", inception), ("dissolved", dissolved)):
            if y is not None and not (YEAR_MIN <= y <= YEAR_MAX) and y != 0:
                rep.add("year-out-of-range", "ERROR", key, f"{label}={y}")

        # D1: unitless area (string with no unit marker)
        area = wd.get("area")
        if isinstance(area, str) and not re.search(r"[a-z²]", area, re.I):
            rep.add("unitless-area", "WARN", key, f"area={area!r}")

        # C1/C2: misclassified Pleiades "buildings"
        if key.startswith("building:"):
            desc = e.get("pleiadesDescription") or e.get("description") or ""
            btype = e.get("buildingType")
            if btype == "arch" and SITE_PHRASES.search(desc):
                rep.add("arch-is-actually-site", "ERROR", key,
                        (e.get("ancientName") or "")[:40] + " :: " + desc[:80])
            if btype == "palace" and VILLA_PHRASES.search(desc):
                rep.add("palace-is-actually-villa", "WARN", key,
                        (e.get("ancientName") or "")[:40] + " :: " + desc[:80])

    # E1: same QID under multiple keys — unless the group was adjudicated
    # same-entity (entities/same-qid-links.json), in which case the shared
    # QID is intentional linked identity, not duplication
    links_path = DATA / "entities" / "same-qid-links.json"
    linked = set()
    if links_path.exists():
        linked = {l["qid"] for l in json.load(open(links_path))}
    for qid, keys in qid_keys.items():
        if len(keys) > 1 and qid not in linked:
            rep.add("duplicate-qid", "WARN", qid, ",".join(sorted(keys)[:6]))

    return cr


def check_buildings(rep):
    b = json.load(open(DATA / "buildings" / "buildings.json"))
    year_dist = Counter(x.get("constructionYear") for x in b)
    fallback = year_dist.get(50, 0)
    if fallback / max(len(b), 1) > 0.10:
        rep.add("constructionYear-default-epidemic", "ERROR", "buildings.json",
                f"{fallback}/{len(b)} records have constructionYear=50 "
                f"(period-bucket midpoint / fallback, not a real date)")
    for x in b:
        if not (-90 <= x.get("lat", 999) <= 90) or not (-180 <= x.get("lng", 999) <= 180):
            rep.add("coords-out-of-range", "ERROR", f"building:{x.get('id')}", str(x)[:80])
    return b


def check_settlement_files(rep):
    for rel, id_prefix in (("dare/settlements.json", "settlement"),
                           ("places/places.json", "place")):
        items = json.load(open(DATA / rel))
        for x in items:
            key = f"{id_prefix}:{x.get('id')}"
            s, e = x.get("startYear"), x.get("endYear")
            if s not in (None, 0) and e not in (None, 0) and e < s:
                rep.add("end-before-start", "ERROR", key, f"start={s} end={e} ({rel})")
            lat, lng = x.get("lat"), x.get("lng")
            if lat is None or lng is None or not (-90 <= lat <= 90 and -180 <= lng <= 180):
                rep.add("coords-out-of-range", "ERROR", key, f"lat={lat} lng={lng} ({rel})")
            if not (x.get("name") or "").strip():
                rep.add("missing-name", "ERROR", key, rel)


def check_cross_dataset_dupes(rep, cr):
    """Same place present as both a settlement:* and building:* entry:
    identical-ish name within ~2.5 km. Uses coords from the layer files.

    Pairs the unified-nodes join has adjudicated as a structure AT that
    settlement's node (rel='at', e.g. 'Amphitheater of Alba Fucens' at
    Alba Fucens) are expected coexistence, not duplicates — skipped.
    rel='same' pairs stay flagged: the join itself says they are one
    entity living in two silos."""
    coords = {}
    b = json.load(open(DATA / "buildings" / "buildings.json"))
    for x in b:
        coords[f"building:{x['id']}"] = (x["lat"], x["lng"], norm_name(x.get("name")))
    d = json.load(open(DATA / "dare" / "settlements.json"))
    for x in d:
        coords[f"settlement:{x['id']}"] = (x["lat"], x["lng"],
                                           norm_name(x.get("name")) or norm_name(x.get("modern")))

    # settlement key -> canonical node id, and building key -> its 'at' join
    dare_node = {}
    try:
        for p in json.load(open(DATA / "places" / "places.json")):
            if p.get("dare"):
                dare_node[f"settlement:{p['dare']['id']}"] = p["id"]
    except FileNotFoundError:
        pass
    at_join = {}
    try:
        for k, j in json.load(open(DATA / "registry" / "unified-nodes.json")).items():
            if j.get("rel") == "at":
                at_join[k] = j.get("node")
    except FileNotFoundError:
        pass

    # bucket by rounded coords for O(n) neighborhood lookup
    buckets = defaultdict(list)
    for key, (lat, lng, name) in coords.items():
        buckets[(round(lat, 1), round(lng, 1))].append((key, lat, lng, name))

    seen = set()
    for cell, members in buckets.items():
        if len(members) < 2:
            continue
        for i, (k1, la1, lo1, n1) in enumerate(members):
            for k2, la2, lo2, n2 in members[i + 1:]:
                if k1.split(":")[0] == k2.split(":")[0]:
                    continue  # same dataset — handled elsewhere
                if not n1 or not n2:
                    continue
                if n1 != n2 and n1 not in n2 and n2 not in n1:
                    # also compare against the other record's alt names via cross-ref
                    alt1 = norm_name((cr.get(k1) or {}).get("modernName"))
                    alt2 = norm_name((cr.get(k2) or {}).get("modernName"))
                    if not (alt1 and alt1 == n2) and not (alt2 and alt2 == n1):
                        continue
                dist_km = math.hypot((la1 - la2) * 111, (lo1 - lo2) * 111 * math.cos(math.radians(la1)))
                if dist_km <= 2.5:
                    bk, sk = (k1, k2) if k1.startswith("building:") else (k2, k1)
                    if at_join.get(bk) and at_join[bk] == dare_node.get(sk):
                        continue  # adjudicated: structure at its town
                    pair = tuple(sorted((k1, k2)))
                    if pair not in seen:
                        seen.add(pair)
                        rep.add("cross-dataset-duplicate", "WARN", " + ".join(pair),
                                f"{n1!r} ~ {n2!r}, {dist_km:.1f} km apart")


def check_tombstones(rep, cr):
    """Deliberately-removed QID links must stay removed. Enrichment passes
    keep re-matching the same nearby-but-wrong QIDs; the cleanup log is the
    tombstone list. Fix resurrections with scripts/enforce-qid-tombstones.py."""
    log_path = DATA / "review" / "qid-cleanup-log.json"
    if not log_path.exists():
        return
    tombs, restored = set(), set()
    for e in json.load(open(log_path)):
        pair = (e["key"], e["qid"])
        action = e.get("action", "")
        if action.startswith(("removed-qid", "qid->containedInQid")):
            tombs.add(pair)
            restored.discard(pair)
        elif "->qid" in action:
            restored.add(pair)
            tombs.discard(pair)
    for k, e in cr.items():
        if e.get("qid") and (k, e["qid"]) in tombs:
            rep.add("resurrected-qid", "ERROR", k,
                    f"qid {e['qid']} was deliberately removed but is back")


def main():
    rep = Report()
    cr = check_cross_reference(rep)
    check_buildings(rep)
    check_settlement_files(rep)
    check_cross_dataset_dupes(rep, cr)
    check_tombstones(rep, cr)

    print(f"\n{'=' * 72}")
    print("ENTITY VALIDATION REPORT")
    print(f"{'=' * 72}")
    errors = 0
    for rule, n in sorted(rep.counts.items(), key=lambda kv: -kv[1]):
        sev = rep.severity[rule]
        if sev == "ERROR":
            errors += n
        print(f"\n[{sev}] {rule}: {n}")
        for ex in rep.findings[rule][:5]:
            print(f"    {ex['key']}: {ex['detail']}")

    print(f"\n{'=' * 72}")
    print(f"TOTAL: {sum(rep.counts.values())} findings "
          f"({errors} error-severity, {sum(rep.counts.values()) - errors} warn)")

    if "--json" in sys.argv:
        out = sys.argv[sys.argv.index("--json") + 1]
        json.dump({"counts": dict(rep.counts), "severity": rep.severity,
                   "examples": dict(rep.findings)}, open(out, "w"), indent=1)
        print(f"full report -> {out}")

    baseline_path = Path(__file__).resolve().parent / "validation-baseline.json"

    if "--update-baseline" in sys.argv:
        dump_atomic(dict(rep.counts), baseline_path, indent=1, sort_keys=True)
        print(f"baseline updated -> {baseline_path}")
        sys.exit(0)

    if "--ci" in sys.argv:
        # Ratchet: known issues are tolerated at their baseline level; any rule
        # that grows past baseline (or appears new) fails the build. After an
        # intentional fix, tighten with --update-baseline.
        baseline = json.load(open(baseline_path)) if baseline_path.exists() else {}
        regressions = [(r, baseline.get(r, 0), n) for r, n in rep.counts.items()
                       if n > baseline.get(r, 0)]
        if regressions:
            print("\nCI RATCHET FAILURES (count exceeds baseline):")
            for r, base, now in regressions:
                print(f"  ✗ {r}: {now} (baseline {base})")
            sys.exit(1)
        print("\nCI ratchet: no rule exceeds baseline")
        sys.exit(0)

    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
