# Scripts

~110 scripts in four working families plus an archive. When adding a script,
place it by family; when a one-shot patch has been applied and committed,
`git mv` it to `archive/`.

## The pipeline (wired, ordered)

`npm run build-data` → `build-data.sh` is the canonical rebuild. Order matters:

1. `build-entities.py` — canonical place nodes (DARE + Chandler + Hanson +
   Modelski + Pleiades + Vici + wd-settlements)
2. **Unified chunks** (STEP 1b): `build-unified-entities.ts` (regen preserves
   chunk-resident enrichments by id-merge) → `normalize-unified-qids.py` →
   `enforce-qid-tombstones.py` → `floor-estimated-dates.py` →
   `floor-era-named-dates.py` → `apply-event-caps.py` →
   `attach-nodes-to-unified.py`
3. `chunk-empires.py`, `slim-itinere.py`, `integrate-orbis-nodes.py`
4. **Derived stores** (STEP 2b): `build-entity-table.py` →
   `build-entity-search.py` → `build-knowledge.py` → `build-manifest.py`.
   The entity table/search manifest MUST rebuild after any upstream date or
   QID change — MonumentLabels and search read them.

`data-hygiene.sh` bundles the rerunnable cleanup passes.
Validation: `npm run validate` (schemas) and `npm run validate:entities`
(ratchet vs `validation-baseline.json` + `validate-golden.py`). The ratchet
only ever goes DOWN: fix at the pipeline, or justify the reset in the commit.

## Ingest tools (`ingest-*`, `generate-*`, `process-*`)

One per dataset; rerunnable when a source updates (new Cliopatria release,
fresh vici dump, Wikidata battles refresh). Each writes into `src/data/` and
is followed by a `build-data` run.

## Enrichment tools (`enrich-*`, `fetch-*`, `match-*`, `backfill-*`)

Network sweeps (Wikipedia extracts, Wikidata QIDs/images, geo-matching).
Resumable by design; they cache under `src/data/downloads/` (gitignored).
After any QID-touching sweep, rerun `enforce-qid-tombstones.py` — wrong QIDs
tend to get re-matched (the validator's resurrected-qid rule catches misses).

## Adjudication (`resolve-*`, `apply-*`)

Plan-producing scripts (`resolve-same-qid-groups.py` → plan JSON) and their
appliers (`apply-same-qid-plan.py`, `apply-qid-verdicts.py`). Decisions land
in `src/data/review/qid-cleanup-log.json` (the tombstone ledger) and
`src/data/entities/same-qid-links.json` (adjudicated shared identity).

## `archive/`

Applied one-shot patches, incident fixes, and superseded versions — kept for
reference, not part of any flow. Nothing may reference `archive/` from live
code or pipeline scripts.
