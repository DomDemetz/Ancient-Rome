/** entity parent-type → the layer/dataset toggle that renders its dots.
 *  ONE source of truth, used by search (turn the layer on when a site is
 *  selected) and MonumentLabels (only label types whose dots are visible).
 *  The layer is a property of the parent TYPE — display subtypes (circus,
 *  basilica, bath, forum...) come and go with the data, and routing layer
 *  mechanics through them silently orphaned every unmapped subtype:
 *  selecting the Circus Maximus never toggled the buildings layer, so the
 *  search ring circled an empty spot. */
export const SITE_TYPE_TO_LAYER: Record<string, { show?: string; dataset?: string }> = {
  amphitheater: { show: 'showAmphitheaters' },
  building: { show: 'showBuildings' },
  aqueduct: { show: 'showAqueducts' },
  battle: { show: 'showBattles' },
  temple: { dataset: 'temples' },
  religion: { dataset: 'religion' },
  religious: { dataset: 'religion' },
  'religious-site': { dataset: 'religion' },
  sanctuary: { dataset: 'religion' },
  shrine: { dataset: 'religion' },
  cemetery: { dataset: 'religion' },
  monastery: { dataset: 'religion' },
  villa: { dataset: 'villas' },
  estate: { dataset: 'villas' },
  farm: { dataset: 'villas' },
  townhouse: { dataset: 'villas' },
  tomb: { dataset: 'tombs' },
  tumulus: { dataset: 'tombs' },
  pyramid: { dataset: 'tombs' },
  bridge: { dataset: 'bridges' },
  mine: { dataset: 'mines' },
  press: { dataset: 'presses' },
  port: { dataset: 'ports' },
  shipwreck: { dataset: 'shipwrecks' },
}
