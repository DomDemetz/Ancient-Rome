# The Entity Model

**End goal: one clean dataset.** One row per real-world thing; every layer,
search index, and detail panel reads a view of that row. No silo may
contradict another. This document is the map from today's state to that goal.

## Where the data stands (2026-07-08)

```
source silos (per-dataset files, committed)
  places/places.json          canonical *place* nodes (DARE+Chandler+Pleiades+Wikidata merge)
  dare/settlements.json       DARE rows (render format)
  buildings/buildings.json    Pleiades structures, reclassified 2026-07-07 from exact featureTypes
  unified/*.json              13 aspect types (amphitheater, port, mine, ...) in a shared schema
  battles/, amphitheaters/,…  older standalone silos

enrichment store
  wiki/cross-reference.json   per-record enrichment keyed by `<type>:<id>`;
                              carries qid, wdProps, sameAsDare, containedInQid

canonical table (build artifact — the unification)
  entities/entity-table.json  built by scripts/build-entity-table.py
```

### Identity links and what they mean

| Link                             | Meaning                                                                                                                   | Written by                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `qid`                            | this record IS that Wikidata entity (verified by the 2026-07-08 swarm: 6,174 records judged against fetched ground truth) | enrichment + swarm verdicts |
| `containedInQid`                 | the QID is the city/region/anchor the thing sits in — true fact, not identity                                             | apply-qid-verdicts.py       |
| `sameAsDare`                     | this building record and that DARE row are the same physical structure                                                    | merge-tier-a-duplicates.py  |
| `pid` / `dare.id` on place nodes | crosswalk joins from build-entities.py                                                                                    | build-entities.py           |

### Entity-table merge rules (build-entity-table.py)

Records collapse into one entity via:

1. explicit crosswalks (`pid`, `dare.id`, `sameAsDare`) — unconditional;
2. shared QID — **only if** normalized name AND kind agree AND records sit
   within ~30 km. Each guard exists because of a real over-merge:
   watchtower chains stamped with the parent fort's QID (name guard),
   aqueducts named after their city (kind guard), three different
   "Ad Pontem"s backfilled to one Wikidata item (proximity guard).

Field precedence inside an entity: first non-empty by source rank
(building > place > dare > aspect silos), provenance recorded per field.
Attestation window = widest across sources.

## Data-quality gates (run on every CI build)

- `scripts/validate-entities.py --ci` — mechanical rules with a ratchet
  baseline (`scripts/validation-baseline.json`); any rule count growing past
  baseline fails. After intentional fixes run `--update-baseline`.
- `scripts/validate-golden.py` — hand-verified famous places, battle dates,
  negative assertions ("Jericho is not a building"), type-distribution caps.

## Field semantics that must not regress

- Pleiades/DARE years are **attestation ranges**, not construction dates.
  UI label is "Attested". An unknown date is `null`, never a default.
- Pleiades featureTypes match as **exact tokens** (substring matching once
  turned archaeological sites into 'arch'es and villas into palaces).
- Wikidata quantities carry **units in the string** ("3.15 km²"); a bare
  number is not a fact.
- A QID on an aspect record (port, mine, wreck) is usually the _nearest
  settlement_, not the thing — that's `containedInQid`, not `qid`.

## Migration path (remaining)

1. ~~QID verification~~ (done — swarm 2026-07-08, 1,077 links corrected)
2. ~~Tier-A duplicate merge~~ (done — 926 merged, log in review/)
3. Review queues: `review/shared-qid-conflicts.json` (37 same-kind QID
   collisions), `review/suspect-qids.json` (7 unresolvable),
   tier B/C pairs in `review/duplicate-pairs.json`. Tier D
   (contains-matches) are buildings inside same-named cities — never merge.
4. Migrate consumers to the entity table one at a time (search index first,
   then detail panel, then layers), regenerating today's per-layer files as
   views until each consumer switches.
5. When the last consumer switches, the silo files stop being committed and
   become build outputs — the table is then the single source of truth.

## Regeneration

```
python3 scripts/build-entity-table.py       # rebuild the table from silos
npm run validate:entities                   # gates
```

Never hand-edit `entities/entity-table.json` or anything in `review/*-log.json`.
