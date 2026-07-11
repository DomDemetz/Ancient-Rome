/**
 * THE source ledger — every data attribution string, once (standardization
 * pass 2026-07-11; these lived in MapView concat, registry fields, and the
 * About dialog). Map bar and About derive from here.
 */

export const BASE_SOURCES = {
  empires:
    'Empires: <a href="https://github.com/Seshat-Global-History-Databank/cliopatria">Cliopatria/Seshat</a> (CC BY 4.0)',
  dare: 'DARE data &copy; Johan &Aring;hlfeldt, CC BY-SA 3.0',
  itinere: 'Itiner-e data &copy; Pau de Soto, CC BY-NC 4.0',
  battles: 'Battle data: Roman-Battles-Droid',
  provinces:
    'Provinces: <a href="https://darmc.harvard.edu">DARMC / Mapping Past Societies</a> (CC BY-NC-SA 4.0) · AWMC',
  conquests:
    'Islamic conquests: <a href="https://darmc.harvard.edu">DARMC / Mapping Past Societies</a> (CC BY-NC-SA 4.0)',
  orbis: 'ORBIS v2 &copy; Stanford University',
  people: 'Notable People: Sciences-Po cross-verified database, CC-BY-SA',
  sites:
    'Sites: <a href="https://vici.org">vici.org</a> (CC BY-SA) · DARE · <a href="https://pleiades.stoa.org">Pleiades</a> (CC BY) · DARMC/OxREP',
} as const

export type AttributionKey = keyof typeof BASE_SOURCES
