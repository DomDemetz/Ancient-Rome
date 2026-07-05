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
  - `crosswalk-battles.json` — **158 of 374 battles (42%)** carry a Wikidata
    QID (bbox query over all dated battles/sieges in the atlas frame).

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

## Validation against native truth

Vici.org's own dump carries curated identity tables (`q_dare`, `q_pleiades`) —
the native cross-references dropped in our original flattening. Imported:
**5,808 native DARE→QID links** (`registry/dare-wikidata.json`) and **+685
bridge QIDs**. Where both a fuzzy-derived and a native QID exist (1,986
records), 72% agree exactly — and inspection shows the "disagreements" are
the same place at two Wikidata granularities (fuzzy→ancient item, e.g.
_Ariminum_; native→modern item, e.g. _Rimini_). The two crosswalks are
complementary aspects, both kept: ancient identity via Pleiades, modern
successor via Vici.

## Adoption path (deliberate, staged)

1. ✅ Registry + crosswalks — additive, no runtime change.
2. ✅ Merge duplicate map dots — dare-suppression.json hides a DARE twin
   while its labeled Chandler city is on screen (245 twins).
3. ✅ Entity detail — city popups resolve place → QID → Wikipedia panel
   (cities-wiki.json: 194 entries, 134 inherited free via the crosswalks);
   +22 battle enrichments via battle QIDs.
4. ✅ Search manifests — cities/emperors/battles searchable from cold start
   (registry/\*-search.json), with lifespan-aware time-jumping.
5. Extend to Vici's 85k sites (suppression + enrichment via q\_\* tables).
6. New datasets (other empires) attach by reusing the same reconciler.
