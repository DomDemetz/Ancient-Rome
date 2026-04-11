export interface HeroContent {
  layerType: string
  itemId: string
  highlight: boolean
  narrative: string
  significance: string
  imageUrl: string | null
  relatedIds: string[]
  funFact: string
}

import { loadJson } from '@/data/loadJson'

export async function loadHeroContent(): Promise<HeroContent[]> {
  return loadJson<HeroContent[]>(() => import('../hero-content.json'))
}
