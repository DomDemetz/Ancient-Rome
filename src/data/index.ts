import { loadAndValidateData } from './loader'

const data = loadAndValidateData()

export const entities = data.entities
export const connections = data.connections
export const stories = data.stories
export { loadTerritories } from './loader'
