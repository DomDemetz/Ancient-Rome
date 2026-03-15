# Research: Roman Road Construction Chronology

## Purpose

Establish reliable time points for animating the development of Roman roads over time on an interactive map, from earliest construction (4th century BC) through the fall of the Western Empire (476 AD).

---

## 1. Current Data Assessment

### Itiner-e Dataset (already in project)

- **14,769 total road segments** in `src/data/itinere/roads.json`
- **Only 477 segments (3.2%) have a `startYear` value** — the remaining 14,292 default to `0` (undated)
- **Only 198 segments have an `endYear` value** — 14,571 default to `0`
- The `builder` field stores certainty levels ("Conjectured", "Certain", "Hypothetical"), not actual builder names
- 173 uniquely named roads have some temporal data

### DARE Dataset (already in project)

- **3,166 road features** in `src/data/dare/roads.json`
- **No temporal metadata at all** — static snapshot of the road network

### Key Problem (confirmed by the Itiner-e paper itself)

> "A major challenge is the absence of chronological evidence of the creation and change of roads at an Empire-wide scale, which means the current dataset cannot show the growth and change over time of Roman roads."
>
> — Itiner-e: Scientific Data, Nature (2025)

This is an **acknowledged open problem in Roman digital humanities**. No complete temporal road dataset exists. What follows is a research synthesis to establish the best available time points.

---

## 2. Dated Named Roads — Primary Source Compilation

### Confidence Levels

- **A** = Literary/epigraphic source directly names the builder and/or construction date
- **B** = Archaeological dating or strong circumstantial evidence (e.g., road built immediately after conquest)
- **C** = Approximate date based on historical context; scholarly consensus but no direct attestation

### 2.1 Italian Peninsula (4th–2nd century BC)

| Road                   | Date                                | Builder                               | Route                                           | Conf. | Source                                           |
| ---------------------- | ----------------------------------- | ------------------------------------- | ----------------------------------------------- | ----- | ------------------------------------------------ |
| **Via Salaria**        | pre-4th c. BC                       | Pre-Roman origins                     | Rome → Reate → Asculum (Adriatic)               | C     | Salt trade route; formalized by Republic         |
| **Via Latina**         | ~490 BC (track); formalized ~328 BC | Unknown; pre-Roman track              | Rome → Capua (inland route)                     | C     | Mentioned during Coriolanus episode; paved later |
| **Via Appia**          | **312 BC**                          | Appius Claudius Caecus (Censor)       | Rome → Capua; extended to Brundisium by ~264 BC | **A** | Livy, Frontinus; UNESCO inscription              |
| **Via Valeria**        | 289–286 BC                          | M. Valerius Maximus (Consul)          | Rome → Alba Fucens → Corfinium                  | B     | Named for Valerian gens                          |
| **Via Amerina**        | ~241 BC                             | Unknown                               | Rome → Ameria (Umbria)                          | C     | Approximate dating                               |
| **Via Aurelia**        | ~241 BC                             | C. Aurelius Cotta (Consul)            | Rome → Pisae → Genua                            | B     | Named for Aurelian gens                          |
| **Via Flaminia**       | **220 BC**                          | C. Flaminius (Consul)                 | Rome → Ariminum (Rimini)                        | **A** | Livy; Flaminius also built Circus Flaminius      |
| **Via Aemilia**        | **187 BC**                          | M. Aemilius Lepidus (Consul)          | Ariminum → Placentia (Piacenza)                 | **A** | Livy 39.2                                        |
| **Via Cassia**         | ~154 BC (uncertain)                 | C. Cassius Longinus (Censor)?         | Rome → Arretium → Florentia                     | C     | Date debated; cannot be earlier than 187 BC      |
| **Via Postumia**       | **148 BC**                          | Sp. Postumius Albinus Magnus (Consul) | Genua → Cremona → Verona → Aquileia             | **A** | Named for consul of 148 BC                       |
| **Via Popillia**       | ~132 BC                             | P. Popillius Laenas (Consul)          | Capua → Rhegium; also Ariminum → Aquileia       | B     | Popillius milestone found near Polla             |
| **Via Aemilia Scauri** | 109 BC                              | M. Aemilius Scaurus (Consul)          | Extended Via Aurelia: Pisae → Luna → Genua      | B     | Continuation of Aurelia network                  |

### 2.2 Western Provinces

| Road                           | Date         | Builder                              | Route                                            | Conf. | Source                                       |
| ------------------------------ | ------------ | ------------------------------------ | ------------------------------------------------ | ----- | -------------------------------------------- |
| **Via Domitia**                | **118 BC**   | Cn. Domitius Ahenobarbus (Proconsul) | Narbonne → Pyrenees; Alps → Nîmes                | **A** | First Roman road in Gaul; milestone evidence |
| **Via Augusta** (Hispania)     | **8–2 BC**   | Augustus (Emperor)                   | Gades (Cádiz) → Pyrenees (~1,500 km)             | **A** | Milestones; Augustus visited Spain 16–13 BC  |
| Gaul radial network (Lyon hub) | ~20 BC–20 AD | Agrippa (under Augustus)             | Lyon → Rhine, Bordeaux, Channel                  | B     | Strabo; Agrippa's road program               |
| **Britain: Watling Street**    | **47–48 AD** | Roman military engineers             | London → Wroxeter (via St Albans)                | **A** | Archaeological excavation dating             |
| **Britain: Fosse Way**         | ~47 AD       | Roman military engineers             | Exeter → Lincoln (frontier road)                 | B     | Marks early provincial boundary              |
| **Britain: Ermine Street**     | ~43–50 AD    | Roman military engineers             | London → Lincoln → York                          | B     | First decades after invasion                 |
| Netherlands limes roads        | ~10 BC–50 AD | Augustan-Claudian military           | Rhine frontier (Tongeren → Maastricht → Heerlen) | B     | Itiner-e dates these -10 to 406 AD           |

### 2.3 Eastern Provinces & Balkans

| Road               | Date           | Builder                                         | Route                                  | Conf. | Source                                         |
| ------------------ | -------------- | ----------------------------------------------- | -------------------------------------- | ----- | ---------------------------------------------- |
| **Via Egnatia**    | **146–120 BC** | Cn. Egnatius (Governor of Macedonia)            | Dyrrachium → Thessalonica → Byzantium  | **A** | Built after Macedonia became province (146 BC) |
| **Via Sebaste**    | **6 BC**       | Cornutus Arruntius Aquila (Governor of Galatia) | Side → Pisidian Antioch                | **A** | Inscriptional evidence; Augustan colony road   |
| Danube limes roads | ~37 AD onward  | Tiberius/Claudian era                           | Ratiaria → Oescus → Novae → Durostorum | B     | Itiner-e dates clusters at 37 AD               |
| Iron Gates road    | ~34 AD         | Tiberian era                                    | Danube gorge military road             | B     | Itiner-e data                                  |
| **Via Militaris**  | 1st century AD | Various emperors                                | Singidunum → Constantinople            | B     | Strategic Balkans trunk road                   |

### 2.4 Imperial Period (1st–3rd century AD)

| Road                                | Date           | Builder                          | Route                                             | Conf. | Source                                                    |
| ----------------------------------- | -------------- | -------------------------------- | ------------------------------------------------- | ----- | --------------------------------------------------------- |
| **Via Traiana** (Italy)             | **109 AD**     | Trajan (Emperor), at own expense | Beneventum → Brundisium (shortcut via Bari)       | **A** | Trajan's Arch at Beneventum                               |
| **Via Nova Traiana** (Arabia)       | **111–114 AD** | C. Claudius Severus (Governor)   | Bostra → Aila (Red Sea) via Petra                 | **A** | Milestones; built after Arabia annexed 106 AD             |
| Dacia road network                  | **106–110 AD** | Trajan's military engineers      | Lederata/Dierna/Drobeta → Sarmizegetusa → Apulum  | B     | Built during/after Dacian Wars; Apollodorus bridge 103 AD |
| Eastern desert quarry roads (Egypt) | ~100–150 AD    | Imperial administration          | Coptos → Myos Hormos / Mons Claudianus / Berenike | B     | Itiner-e dates; quarrying period                          |
| Arabia frontier roads               | ~111 AD        | Trajanic-Hadrianic               | Petra → Zodocatha; Dibon → Aeropolis              | B     | Itiner-e data; Via Nova extensions                        |
| North Africa trunk roads            | ~123 AD+       | Hadrianic era                    | Carthago → Ammaedara; Lepcis Magna roads          | B     | Itiner-e dates; provincial consolidation                  |
| **Strata Diocletiana**              | **284–305 AD** | Diocletian (Emperor)             | Euphrates → Palmyra → Damascus → Arabia           | **A** | Part of eastern frontier fortification                    |

---

## 3. Proposed Animation Time Points

Based on the research above, here are **historically meaningful snapshots** for animating road network growth. These align with the territory snapshots already in the project (-500, -338, -298, etc.).

| Year     | Phase                     | Roads Visible                                                                | Historical Context                                        |
| -------- | ------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------- |
| **-500** | Pre-Roman tracks          | Via Salaria (track), Via Latina (track)                                      | Salt routes, Etruscan paths; earthen tracks only          |
| **-312** | First paved road          | + Via Appia (Rome→Capua)                                                     | Appius Claudius; Second Samnite War                       |
| **-264** | Italian trunk network     | + Via Appia extended to Brundisium, Via Valeria, Via Amerina, Via Aurelia    | Start of Punic Wars; Italy connected                      |
| **-220** | Northern expansion        | + Via Flaminia                                                               | Connects Rome to Adriatic; prelude to Hannibalic War      |
| **-187** | Po Valley                 | + Via Aemilia, Via Cassia                                                    | Post-Second Punic War; Cisalpine colonization             |
| **-148** | Northern Italy complete   | + Via Postumia, Via Popillia                                                 | Genua to Aquileia; Italy fully networked                  |
| **-118** | First provincial road     | + Via Domitia, Via Egnatia                                                   | Gallia Narbonensis; Macedonian trunk route                |
| **-27**  | Augustan program begins   | + Via Augusta (Spain), Gaul radial network, Via Sebaste                      | Augustus reorganizes provinces; Agrippa's road plan       |
| **14**   | Augustan network complete | + Britain initial (if applicable), Netherlands limes, Danube limes start     | Death of Augustus; provincial networks maturing           |
| **47**   | Claudian expansion        | + Watling Street, Fosse Way, Ermine Street, Danube roads                     | Conquest of Britain; Claudian infrastructure push         |
| **117**  | Trajanic peak             | + Via Traiana, Via Nova Traiana, Dacia network, Egypt quarry roads           | Maximum extent of empire; peak road building              |
| **200**  | Severan maintenance       | + North Africa completions, Eastern provincial roads, Via Militaris complete | Network essentially complete; focus shifts to maintenance |
| **300**  | Diocletianic renewal      | + Strata Diocletiana, frontier road repairs                                  | Last major building program; tetrarchy                    |
| **400**  | Decline begins            | Network starts contracting at periphery                                      | Western provinces losing maintenance capability           |
| **476**  | Post-Roman fragmentation  | Core Italian/Eastern roads persist; peripheral roads deteriorating           | Fall of Western Empire; Eastern roads maintained          |

---

## 4. Implementation Strategy

### Approach A: Assign dates to undated roads by proximity to conquest

Since 96.8% of Itiner-e roads lack dates, the most practical approach is:

1. **Keep all 477 already-dated segments as-is**
2. **For undated roads, infer `startYear` from the date the region came under Roman control**, using the existing territory snapshots as a guide:
   - If a road falls within territory controlled at year X but not at year X-1, assign `startYear ≈ X`
   - Add a buffer of ~20 years for road construction after conquest
3. **For DARE roads** (undated), cross-reference with Itiner-e names/geography where possible

### Approach B: Phase-based grouping

Assign roads to broad phases rather than specific years:

- Phase 1: Italian trunk roads (-312 to -148 BC)
- Phase 2: Western Mediterranean expansion (-118 to -27 BC)
- Phase 3: Augustan-Claudian provincial networks (-27 BC to 68 AD)
- Phase 4: Flavian-Trajanic peak (69–138 AD)
- Phase 5: Imperial maintenance and eastern expansion (138–284 AD)
- Phase 6: Late Roman renewal and decline (284–476 AD)

### Approach C: Territory-correlated appearance

Roads appear when their surrounding territory polygon appears, with major named roads appearing at their attested dates. This leverages existing data without false precision.

---

## 5. Academic Sources & References

### Primary Datasets

- [Itiner-e: A high-resolution dataset of roads of the Roman Empire](https://www.nature.com/articles/s41597-025-06140-z) — Nature Scientific Data (2025), de Soto et al.
- [Digital Atlas of the Roman Empire (DARE)](https://imperium.ahlfeldt.se/) — University of Gothenburg
- [DARMC: Digital Atlas of Roman and Medieval Civilizations](https://darmc.harvard.edu/data-availability) — Harvard

### Secondary Sources

- [Roman road system](https://www.britannica.com/technology/Roman-road-system) — Encyclopaedia Britannica
- [Roman Roads](https://www.worldhistory.org/article/758/roman-roads/) — World History Encyclopedia
- [Road Construction through expansion and consolidation](https://engineeringrome.org/road-construction-through-expansion-and-consolidation-of-the-roman-republic-and-the-roman-empire/) — Engineering Rome
- [Via Egnatia, 146 BCE to c. 1200 CE](https://www.worldhistory.org/image/19903/via-egnatia-146-bce-to-c-1200-ce/) — World History Encyclopedia
- [Roman roads in Britannia](https://en.wikipedia.org/wiki/Roman_roads_in_Britannia) — Wikipedia
- [Via Sebaste](https://www.anatolianroads.org/via-sebaste/) — Anatolian Roads Project
- [The Surprisingly Vast Reach of Ancient Roman Roads](https://www.history.com/articles/ancient-roman-roads-network) — HISTORY
- [Via Augusta](https://en.wikipedia.org/wiki/Via_Augusta) — Wikipedia
- [Via Traiana Nova](https://en.wikipedia.org/wiki/Via_Traiana_Nova) — Wikipedia
- [Strata Diocletiana](https://en.wikipedia.org/wiki/Strata_Diocletiana) — Wikipedia

### Key Classical Sources (for named road datings)

- Livy, _Ab Urbe Condita_ — primary source for Republican road construction
- Strabo, _Geographica_ — describes Agrippa's Gaul road program
- Frontinus, _De Aquaeductu_ — mentions Appius Claudius Caecus
- Tabula Peutingeriana — medieval copy of Roman road map (~4th century AD original)
- Antonine Itinerary — 3rd century road guide with distances

---

## 6. Confidence Assessment

| Category                      | Quality      | Notes                                             |
| ----------------------------- | ------------ | ------------------------------------------------- |
| Major Italian viae (dates)    | **High**     | Literary sources name builders and years          |
| Via Egnatia, Domitia, Augusta | **High**     | Epigraphic/milestone evidence                     |
| Trajanic roads                | **High**     | Imperial building programs well-documented        |
| British roads                 | **Medium**   | Archaeological dating; some debate on exact years |
| Provincial secondary roads    | **Low**      | Mostly undated; inferred from conquest chronology |
| Road abandonment dates        | **Very Low** | Deterioration was gradual, varied by region       |

### What we know well

- When the ~30 major _named_ viae were built (to within a decade or two)
- The general pattern: roads followed conquest, built by military engineers
- Peak network extent (~2nd century AD, Trajan/Hadrian)

### What we don't know well

- Exact dates for 97% of secondary/local roads
- When specific road segments fell into disuse
- The intermediate construction phases of long roads (e.g., Via Appia was extended over ~50 years)

---

_Research compiled 2026-03-15. This document synthesizes web-accessible academic and encyclopedic sources. For peer-reviewed specifics, the Itiner-e paper (Nature, 2025) and the Barrington Atlas of the Greek and Roman World remain the gold-standard references._
