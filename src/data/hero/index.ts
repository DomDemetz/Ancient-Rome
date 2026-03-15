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

export async function loadHeroContent(): Promise<HeroContent[]> {
  const data = await import('../hero-content.json')
  return data.default as unknown as HeroContent[]
}
