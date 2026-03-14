import type { Entity, ConnectionType } from '@/types'

export const entityColors: Record<Entity['entityType'], string> = {
  person: 'var(--color-entity-person)',
  organization: 'var(--color-entity-organization)',
  event: 'var(--color-entity-event)',
  location: 'var(--color-entity-location)',
  document: 'var(--color-entity-document)',
  legion: 'var(--color-entity-legion)',
  dynasty: 'var(--color-entity-dynasty)',
  religion: 'var(--color-entity-religion)',
  'trade-good': 'var(--color-entity-trade-good)',
  infrastructure: 'var(--color-entity-infrastructure)',
}

export const entityLabels: Record<Entity['entityType'], string> = {
  person: 'Person',
  organization: 'Organization',
  event: 'Event',
  location: 'Location',
  document: 'Document',
  legion: 'Legion',
  dynasty: 'Dynasty',
  religion: 'Religion',
  'trade-good': 'Trade Good',
  infrastructure: 'Infrastructure',
}

export type ConnectionCategory = 'political' | 'military' | 'social' | 'geographic' | 'cultural'

export const connectionCategoryColors: Record<ConnectionCategory, string> = {
  political: 'var(--color-connection-political)',
  military: 'var(--color-connection-military)',
  social: 'var(--color-connection-social)',
  geographic: 'var(--color-connection-geographic)',
  cultural: 'var(--color-connection-cultural)',
}

const connectionCategoryMap: Record<ConnectionType, ConnectionCategory> = {
  // Political
  alliance: 'political',
  opposition: 'political',
  faction: 'political',
  succession: 'political',
  assassination: 'political',
  appointment: 'political',
  // Military
  commanded: 'military',
  served_in: 'military',
  battle_participation: 'military',
  campaign: 'military',
  defeated: 'military',
  // Social
  family: 'social',
  mentorship: 'social',
  patronage: 'social',
  rivalry: 'social',
  marriage: 'social',
  // Geographic
  located_in: 'geographic',
  governed: 'geographic',
  trade_route: 'geographic',
  military_route: 'geographic',
  // Cultural
  authored: 'cultural',
  dedicated_to: 'cultural',
  worship: 'cultural',
  built: 'cultural',
  founded: 'cultural',
}

export function getConnectionCategory(connectionType: ConnectionType): ConnectionCategory {
  return connectionCategoryMap[connectionType]
}
