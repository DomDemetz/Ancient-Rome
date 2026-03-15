/**
 * Maps DARE road `name` property → attested construction year.
 * Includes variant spellings (Via_Appia, via Sebaste, etc.).
 * Sources: docs/research-roman-road-chronology.md
 */

function normalize(name: string): string {
  return name.replace(/_/g, ' ').replace(/\?$/g, '').toLowerCase().trim()
}

const ATTESTED_DATES: Record<string, number> = {
  'via salaria': -340,
  'via salaria vetus': -340,
  'via latina': -328,
  'via appia': -312,
  'via valeria': -289,
  'via claudia valeria': -289,
  'via amerina': -241,
  'via aurelia': -241,
  'via clodia': -225,
  'via flaminia': -220,
  'via aemilia': -187,
  'via aemilia scauri': -109,
  'via aemilia scauri/ via aurelia': -109,
  'via aemilia scauri/via iulia augusta': -109,
  'via cassia': -154,
  'via postumia': -148,
  'via postumia/via iulia augusta': -148,
  'via popillia': -132,
  'via egnatia': -146,
  'via domitia': -118,
  'hodos berenikes': -200,
  'hodos myos hormou/mysormitike': -200,
  'via iulia augusta': -13,
  'via claudia augusta': -15,
  'via augusta': -8,
  'via sebaste': -6,
  'via cornelia': -30,
  'via labicana': -30,
  'via praenestina': -30,
  'via tiburtina': -30,
  'via nomentana': -30,
  'via collatina': -30,
  'via ostiensis': -30,
  'via portuensis': -30,
  'via laurentina': -30,
  'via ardeatina': -30,
  'via triumphalis': -30,
  'via campana': -30,
  'via curia': -30,
  'via caecilia': -200,
  'via claudia nova': 47,
  'via flavia': 78,
  'via traiana': 109,
  'via minucia / traiana': 109,
  'via traiana nova': 111,
  'via nova traiana': 111,
  'via hadriana': 130,
  'via severiana': 198,
  'via herculia': 290,
  'via herdonitana': 109,
  'via annia': -131,
  'via pompeia': 61,
  'via caminia': -241,
  'via ciminia': -241,
  'via per alpes numidicas': 123,
  'via quinctia': -123,
  'strata diocletiana': 290,
  'iter praeter caput saxi': -200,
  'via militaris': 33,
}

export function getAttestedYear(name: string): number | null {
  return ATTESTED_DATES[normalize(name)] ?? null
}

export function isNamedRoad(name: string | undefined): boolean {
  if (!name) return false
  return normalize(name) in ATTESTED_DATES
}
