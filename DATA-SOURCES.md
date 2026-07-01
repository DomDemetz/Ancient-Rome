# Data Sources & Attribution

This project is an interactive atlas built on top of open scholarly data about the
ancient world. **The underlying geographic and historical data is not ours** — it comes
from the public archaeological and digital-humanities commons listed below. We are
grateful to these projects and reproduce their required attribution here.

The application code, the narrative/editorial content, and the interface are our own
(see `LICENSE`). The data carries the licenses of its respective sources.

## Sources

| Source                                                        | What we use                        | License                                      | Attribution required                                                            |
| ------------------------------------------------------------- | ---------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| [Pleiades](https://pleiades.stoa.org/)                        | Ancient places, coordinates, names | **CC-BY 3.0** ✅ verified                    | Ancient World Mapping Center & Institute for the Study of the Ancient World     |
| [AWMC geodata](https://github.com/AWMC/geodata)               | Coastlines, features, roads        | **ODbL 1.0** ✅ verified — _share-alike_     | Ancient World Mapping Center; derived from the Barrington Atlas & OpenStreetMap |
| [ORBIS v2](https://github.com/emeeks/orbis_v2)                | Roman route network / travel model | **MIT** ✅ verified                          | Elijah Meeks & Walter Scheidel, Stanford University                             |
| [Vici.org](https://vici.org/)                                 | Archaeological sites               | **CC-BY-SA 3.0** ✅ verified — _share-alike_ | René Voorburg / Vici.org contributors                                           |
| [Wikidata](https://www.wikidata.org/)                         | Structured entity data             | **CC0** (public domain)                      | Wikidata contributors                                                           |
| [Wikipedia](https://en.wikipedia.org/)                        | Entity descriptions / enrichment   | text under **CC-BY-SA 4.0**                  | Wikipedia contributors                                                          |
| [Pelagios / Peripleo / Recogito](https://pelagios.org/)       | Place gazetteer links              | CC-BY _(confirm per-endpoint)_ ⚠️            | Pelagios Network                                                                |
| [DARMC (Harvard Dataverse)](https://dataverse.harvard.edu/)   | Roads, places                      | per-dataset _(confirm)_ ⚠️                   | Digital Atlas of Roman & Medieval Civilizations, Harvard                        |
| [Zenodo record 17122148](https://zenodo.org/records/17122148) | Itinere roads (GeoJSON)            | per-record _(confirm)_ ⚠️                    | see Zenodo record                                                               |
| [iDAI.gazetteer](https://idai.world/)                         | Archaeological sites               | DAI terms _(confirm)_ ⚠️                     | Deutsches Archäologisches Institut                                              |

✅ = license verified 2026-07-01 against the source.
⚠️ = **not yet verified** — confirm the exact terms before public launch. These are the
remaining items on the license checklist.

## What the share-alike sources mean for us

**AWMC (ODbL) and Vici (CC-BY-SA)** are copyleft _on the data_. Practically:

- Any dataset we publish that is derived from them must be offered under compatible
  share-alike terms. We therefore keep our integrated data **open**, not proprietary.
- This does **not** restrict our application **code** or our original **narrative
  content** — those are separate works under our own `LICENSE`.

## Attribution in the product

The running application should surface a visible credit line (e.g. an "About / Data"
panel) linking back to this file and to each source. Attribution is a license
_requirement_ for Pleiades, AWMC, Vici, Wikipedia, and Pelagios — not optional.
