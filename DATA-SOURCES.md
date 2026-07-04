# Data Sources & Attribution

This project is an interactive atlas built on top of open scholarly data about the
ancient world. **The underlying geographic and historical data is not ours** — it comes
from the public archaeological and digital-humanities commons listed below. We are
grateful to these projects and reproduce their required attribution here.

The application code, the narrative/editorial content, and the interface are our own
(see `LICENSE`). The data carries the licenses of its respective sources.

## Core place & geography data

| Source                                          | What we use                          | License                             | Attribution                                                                 |
| ----------------------------------------------- | ------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------- |
| [Pleiades](https://pleiades.stoa.org/)          | Ancient places, coordinates, names   | **CC-BY 3.0** ✅                    | Ancient World Mapping Center & Institute for the Study of the Ancient World |
| [AWMC geodata](https://github.com/AWMC/geodata) | Coastlines, features, roads          | **ODbL 1.0** ✅ — _share-alike_     | AWMC; derived from the Barrington Atlas & OpenStreetMap                     |
| [DARE](https://imperium.ahlfeldt.se/)           | Roads, settlements, provinces, water | **CC-BY-SA 3.0** ✅ — _share-alike_ | Johan Åhlfeldt (Digital Atlas of the Roman Empire)                          |
| [ORBIS v2](https://github.com/emeeks/orbis_v2)  | Route network / travel model         | **MIT** ✅                          | Elijah Meeks & Walter Scheidel, Stanford University                         |
| [Vici.org](https://vici.org/)                   | Archaeological sites                 | **CC-BY-SA 3.0** ✅ — _share-alike_ | René Voorburg / Vici.org contributors                                       |
| [Wikidata](https://www.wikidata.org/)           | Structured entity data               | **CC0** (public domain)             | Wikidata contributors                                                       |
| [Wikipedia](https://en.wikipedia.org/)          | Entity descriptions / enrichment     | text under **CC-BY-SA 4.0**         | Wikipedia contributors                                                      |

## Layer-specific data

| Source                                                                            | Layer                  | License                                                         | Attribution                                                       |
| --------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| [Itiner-e](https://zenodo.org/records/17122148)                                   | Roman roads (detailed) | **CC-BY-NC 4.0** ⚠️ _non-commercial_                            | Pau de Soto                                                       |
| [OxREP](https://oxrep.classics.ox.ac.uk/)                                         | Mines, shipwrecks      | OxREP terms _(confirm)_ ⚠️                                      | Oxford Roman Economy Project                                      |
| DARMC / OxREP                                                                     | Shipwrecks             | **CC-BY-NC-SA 4.0** (DARMC/MAPS) ✅ verified — _non-commercial_ | DARMC, Harvard / OxREP                                            |
| [Roman-Battles-Droid](https://github.com/rharriso/Roman-Battles-Droid)            | Battles (classical)    | **no explicit license** ⚠️ verified 2026-07-04                  | rharriso — attribution given; plan: re-source from Wikidata (CC0) |
| [roman-amphitheaters](https://github.com/roman-amphitheaters/roman-amphitheaters) | Amphitheaters          | **Unlicense** (public domain) ✅ verified                       | Sebastian Heath et al.                                            |
| Sciences-Po cross-verified database                                               | Notable people         | **CC-BY-SA** ⚠️                                                 | Sciences-Po                                                       |
| [Pelagios / Peripleo / Recogito](https://pelagios.org/)                           | Place gazetteer links  | CC-BY _(confirm)_ ⚠️                                            | Pelagios Network                                                  |
| [iDAI.gazetteer](https://idai.world/)                                             | Archaeological sites   | DAI terms _(confirm)_ ⚠️                                        | Deutsches Archäologisches Institut                                |

✅ = license verified 2026-07-01 against the source (or the source's own attribution string).
⚠️ = confirm the exact terms before relying on this layer commercially.

## ⚠️ Important: one source is non-commercial

**Itiner-e** (the detailed Roman roads layer) is **CC-BY-NC 4.0** — _non-commercial_.

- ✅ Fine for this project's current use: a free, open-source, non-commercial atlas.
- ❌ It would **block any commercial use** of that specific layer. If this ever
  becomes a paid product, either drop the Itiner-e layer or obtain a commercial
  license from the author.

## Share-alike sources

**AWMC (ODbL), DARE (CC-BY-SA), and Vici (CC-BY-SA)** are copyleft _on the data_:

- Any dataset we redistribute that is derived from them must be offered under
  compatible share-alike terms. We therefore keep our integrated data **open**.
- This does **not** restrict our application **code** or original **narrative
  content** — those are separate works under our own `LICENSE`.

## Attribution in the product

The running app surfaces these credits in two visible places (a license _requirement_):

- The **map attribution control** (bottom of the map) names the tile and data sources,
  expanding as layers are toggled on.
- The **landing-page footer** credits the core sources and links back here.
