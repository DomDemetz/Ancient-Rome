# The Hidden Network — An Interactive Atlas of Ancient Rome

Watch the Roman Empire rise and fall on an interactive map. Trace battles, roads,
legions, emperors, aqueducts, and the trade routes that bound an empire — across a
thousand years of history, on a single timeline you can scrub through.

<!-- Live demo: add URL here once deployed -->
<!-- Screenshot: add public/og-image.png (a real 1200×630 capture of the map) -->

## Why this exists

There is an enormous amount of excellent, openly-licensed data about the ancient
world — Pleiades, the Ancient World Mapping Center, ORBIS, Vici, and more. It's
accurate and it's free, but it's scattered across a dozen formats and rarely
_experienceable_. This project stitches it into one coherent, temporally-aware map
and wraps it in a narrative you can actually follow.

**The data is the commons; the experience is the contribution.**

## Features

- **Timeline playback** — scrub through ~1,000 years and watch territory, roads, and
  cities change over time, with smooth cross-fades between eras.
- **Layered atlas** — battles, legions, emperors, aqueducts, ports, mines, trade
  routes, epigraphy, shipwrecks, religious sites, and more, each toggleable.
- **Story mode** — guided narrative tours (Hannibal's march, the fall of the
  Republic) that drive the map for you.
- **Connections graph** — explore how people, places, and events relate.
- **Search & detail** — every place, person, and event is inspectable, cross-linked,
  and enriched from Wikipedia/Wikidata.

## Tech stack

React 19 · TypeScript · Vite · Leaflet · D3 · Zustand · Tailwind. All rendering is
client-side; the historical data ships as static JSON.

## Getting started

```bash
npm install
npm run dev        # start the dev server
npm run build      # type-check + production build
npm run test       # run the test suite
```

Map tiles use [Stadia Maps](https://stadiamaps.com/). Copy `.env.example` to `.env`
and add your own key:

```
VITE_STADIA_API_KEY=your_key_here
```

> Note: `VITE_`-prefixed variables are inlined into the client bundle at build time,
> so this key is visible in the deployed site. Restrict it to your domain in the
> Stadia dashboard — it is not a secret.

## Data & attribution

The historical data is **not ours** — it comes from the open digital-humanities
commons and carries each source's own license (CC-BY, CC-BY-SA, ODbL, MIT, CC0). We
are grateful to those projects. See **[DATA-SOURCES.md](./DATA-SOURCES.md)** for the
full list, licenses, and required attribution.

## License

Application code and original narrative content: **MIT** (see [LICENSE](./LICENSE)).
Bundled/fetched data: licensed by its respective sources — see
[DATA-SOURCES.md](./DATA-SOURCES.md).
