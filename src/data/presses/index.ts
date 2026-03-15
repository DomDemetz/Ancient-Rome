export interface Press {
  id: string
  name: string
  lat: number
  lng: number
  pressType: 'oil' | 'wine'
  startYear: number
  endYear: number
  description: string
  source: string
}

export async function loadPresses(): Promise<Press[]> {
  const data = await import('./presses.json')
  return data.default as unknown as Press[]
}
