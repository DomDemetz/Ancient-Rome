export interface AncientPort {
  id: string
  name: string
  lat: number
  lng: number
  portType: string
  description: string
  startYear: number
  endYear: number
  source: string
}

export async function loadPorts(): Promise<AncientPort[]> {
  const data = await import('../ancient-ports.json')
  return data.default as unknown as AncientPort[]
}
