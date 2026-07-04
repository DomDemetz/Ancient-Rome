# The Entity Model — canonical places across datasets

**Goal:** one canonical record per real-world place (later: battle, person),
which every dataset attaches to — no duplicate map elements, consistent
identity across sources and time, and a clean path to adding new datasets
(other empires, other eras) without re-solving identity each time.

## Architecture

- **Spine = Pleiades ID.** Our richest gazetteer (25,260 places) already
  carries real Pleiades IDs.
- **Wikidata QID via P1584.** One SPARQL query yields the Pleiades↔Wikidata
  bridge (`registry/pleiades-wikidata.json`): **9,732 of our places (38%)**
  have a QID — bringing Wikidata's labels (the Rome↔Roma alias problem,
  solved at the source) and every other authority ID Wikidata knows.
- **Crosswalks, built at ingest time** (never at runtime):
  - `crosswalk-dare.json` — **12,181 of 25,531 DARE settlements (47%)**
    link to a Pleiades place ≤10 km with a shared name variant. These are
    the measured duplicate rows between our two big gazetteers.
  - `crosswalk-chandler.json` — **259 of 779 cities (33%)** link to their
    ancient antecedent (direct, or two-hop via DARE's modern names). The
    unmatched remainder is dominated by genuinely new medieval foundations
    (Venice, Baghdad, Fez) — correctly unmatched.
  - `crosswalk-battles.json` — **43 battles** carry a Wikidata QID (v1;
    grows as the participant query widens).

## Matching rules (scripts/build-place-crosswalks.py)

Pairwise best-match, no transitive chaining (chaining produced 429 "Romes"
in the prototype). A record links to the _single nearest_ spine place that
shares a name variant, within a tight radius (10 km DARE / 25 km Chandler).
Name variants per place: all `/`-separated segments of the Pleiades name,
DARE name/modern/greek, the Wikidata English label, and a small curated
exonym table (athens→athenae …). Settlement-type places outrank same-name
minor features (Athens vs. the Agora Mint). Gold-standard check: 6/7 famous
cities resolve correctly (Antioch's ancient record is absent from our
Pleiades subset — coverage gap, not matcher error).

## Battles: measured, not assumed

Wikidata is **not** a wholesale replacement for the battle layer: only 131
Roman-participant battles there carry date+coords and **none** carry a
structured winner, vs. our 361 with outcomes. So the dataset stays, gains
QIDs, and fields can be progressively re-derived from CC0 sources —
addressing the Roman-Battles-Droid license note in DATA-SOURCES.md.

## Adoption path (deliberate, staged)

1. ✅ Registry + crosswalks (this commit) — additive, no runtime change.
2. Merge duplicate map dots: settlement layers consult crosswalks at build
   time to drop/merge the 12k duplicate rows.
3. Entity detail: popups resolve place → QID → richer enrichment.
4. New datasets (other empires) attach by reusing the same reconciler.
