# Ancient Rome — Interactive History Investigation Platform

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new independent repository for an Ancient Rome interactive history investigation platform with network graphs, maps, timelines, and guided stories.

**Architecture:** Hybrid feature modules + shared layer. Features (graph, map, timeline, detail, search, stories, filters, stats) own their components. Zustand stores, Zod-validated data layer, and shared utilities live in dedicated top-level directories. All types inferred from Zod schemas.

**Tech Stack:** React 19, TypeScript, Vite, Zustand, Tailwind CSS v4, shadcn/ui, D3.js, Leaflet, Fuse.js, Zod, Vitest, React Testing Library

**Spec:** `docs/superpowers/specs/2026-03-14-ancient-rome-project-design.md` (in Free Masons repo)

**New repo location:** `~/Documents/GitHub-Personal/Ancient-Rome/`

---

## Chunk 1: Project Scaffolding & Data Layer

### Task 1: Scaffold Vite + React + TypeScript project

**Files:**

- Create: `~/Documents/GitHub-Personal/Ancient-Rome/` (new repo)

- [ ] **Step 1: Create Vite project**

```bash
cd ~/Documents/GitHub-Personal
npm create vite@latest Ancient-Rome -- --template react-ts
cd Ancient-Rome
npm install
```

- [ ] **Step 2: Initialize git**

```bash
git init
git add -A
git commit -m "chore: scaffold Vite + React + TypeScript project"
```

- [ ] **Step 3: Verify dev server runs**

```bash
npm run dev
```

Expected: Dev server starts on localhost, React app renders.

---

### Task 2: Install dependencies

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install production dependencies**

```bash
npm install zustand d3 leaflet react-leaflet fuse.js zod react-router-dom @vercel/analytics
npm install -D @types/d3 @types/leaflet
```

- [ ] **Step 2: Install dev/testing dependencies**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
npm install -D prettier eslint-config-prettier simple-git-hooks lint-staged
npm install -D @tailwindcss/vite tailwindcss
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install all project dependencies"
```

---

### Task 3: Configure Tailwind CSS v4

**Files:**

- Modify: `vite.config.ts`
- Create: `src/index.css`

- [ ] **Step 1: Add Tailwind Vite plugin**

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 2: Set up index.css with Tailwind + CSS variables for theming**

```css
/* src/index.css */
@import 'tailwindcss';

@theme {
  --color-bg-primary: #0f0a1a;
  --color-bg-secondary: #1a1425;
  --color-bg-card: #231d30;
  --color-text-primary: #e8e8e8;
  --color-text-secondary: #a0a0b0;
  --color-border: #3a3450;
  --color-accent-gold: #d4af37;
  --color-accent-red: #c0392b;
  --color-accent-blue: #2980b9;

  /* Entity type colors */
  --color-entity-person: #50c878;
  --color-entity-organization: #9b59b6;
  --color-entity-event: #e74c3c;
  --color-entity-location: #3498db;
  --color-entity-document: #f39c12;
  --color-entity-legion: #c0392b;
  --color-entity-dynasty: #d4af37;
  --color-entity-religion: #8e44ad;
  --color-entity-trade-good: #e67e22;
  --color-entity-infrastructure: #7f8c8d;
}
```

- [ ] **Step 3: Verify Tailwind works**

Replace `src/App.tsx` content with:

```tsx
function App() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center">
      <h1 className="text-3xl font-bold text-accent-gold">Ancient Rome</h1>
    </div>
  )
}
export default App
```

Run `npm run dev`, verify gold text on dark background.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: configure Tailwind CSS v4 with Roman theme"
```

---

### Task 4: Configure shadcn/ui

**Files:**

- Create: `src/ui/` directory via shadcn init
- Create: `components.json`

- [ ] **Step 1: Initialize shadcn**

```bash
npx shadcn@latest init
```

Select: TypeScript, New York style, CSS variables. Set components path to `src/ui`.

- [ ] **Step 2: Add initial components needed for the app shell**

```bash
npx shadcn@latest add button drawer dialog tooltip dropdown-menu scroll-area badge separator input
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: initialize shadcn/ui with core components"
```

---

### Task 5: Configure Vitest

**Files:**

- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Create Vitest config**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
  resolve: {
    alias: { '@': '/src' },
  },
})
```

- [ ] **Step 2: Create test setup**

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 3: Add test script to package.json**

Add to `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Add path alias to tsconfig**

Add to `compilerOptions`:

```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: configure Vitest with React Testing Library"
```

---

### Task 6: Configure ESLint, Prettier, git hooks

**Files:**

- Create: `eslint.config.js`
- Create: `.prettierrc`
- Modify: `package.json` (hooks + lint-staged)

- [ ] **Step 1: Create ESLint flat config**

```javascript
// eslint.config.js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
)
```

- [ ] **Step 2: Create Prettier config**

```json
// .prettierrc
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 3: Configure git hooks in package.json**

Add to `package.json`:

```json
"simple-git-hooks": {
  "pre-commit": "npx lint-staged"
},
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,css}": ["prettier --write"]
}
```

Run: `npx simple-git-hooks`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: configure ESLint 9, Prettier, and git hooks"
```

---

### Task 7: Create Zod schemas for all entity types

**Files:**

- Create: `src/data/schemas/base.ts`
- Create: `src/data/schemas/person.ts`
- Create: `src/data/schemas/organization.ts`
- Create: `src/data/schemas/event.ts`
- Create: `src/data/schemas/location.ts`
- Create: `src/data/schemas/document.ts`
- Create: `src/data/schemas/legion.ts`
- Create: `src/data/schemas/dynasty.ts`
- Create: `src/data/schemas/religion.ts`
- Create: `src/data/schemas/trade-good.ts`
- Create: `src/data/schemas/infrastructure.ts`
- Create: `src/data/schemas/connection.ts`
- Create: `src/data/schemas/story.ts`
- Create: `src/data/schemas/territory.ts`
- Create: `src/data/schemas/index.ts`
- Test: `src/data/schemas/schemas.test.ts`

- [ ] **Step 1: Write tests for schema validation**

```typescript
// src/data/schemas/schemas.test.ts
import { describe, it, expect } from 'vitest'
import { PersonSchema, ConnectionSchema, EntitySchema, ConnectionTypeSchema } from '.'

describe('PersonSchema', () => {
  it('accepts valid person', () => {
    const result = PersonSchema.safeParse({
      id: 'julius-caesar',
      name: 'Julius Caesar',
      entityType: 'person',
      description: 'Roman dictator',
      born: -100,
      died: -44,
      roles: ['dictator', 'general'],
      faction: 'Populares',
      sources: ['https://en.wikipedia.org/wiki/Julius_Caesar'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects person missing required name', () => {
    const result = PersonSchema.safeParse({
      id: 'test',
      entityType: 'person',
      description: 'test',
      sources: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects person with wrong entityType', () => {
    const result = PersonSchema.safeParse({
      id: 'test',
      name: 'Test',
      entityType: 'location',
      description: 'test',
      sources: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('ConnectionSchema', () => {
  it('accepts valid connection', () => {
    const result = ConnectionSchema.safeParse({
      id: 'conn-1',
      source: 'julius-caesar',
      target: 'roman-senate',
      connectionType: 'opposition',
      strength: 3,
      evidence: 'Caesar crossed the Rubicon in defiance of the Senate',
      sources: ['https://en.wikipedia.org/wiki/Crossing_the_Rubicon'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid connection type', () => {
    const result = ConnectionSchema.safeParse({
      id: 'conn-1',
      source: 'a',
      target: 'b',
      connectionType: 'invalid_type',
      strength: 1,
      evidence: 'test',
      sources: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects strength outside 1-3', () => {
    const result = ConnectionSchema.safeParse({
      id: 'conn-1',
      source: 'a',
      target: 'b',
      connectionType: 'alliance',
      strength: 5,
      evidence: 'test',
      sources: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('EntitySchema', () => {
  it('discriminates by entityType', () => {
    const person = EntitySchema.safeParse({
      id: 'test',
      name: 'Test',
      entityType: 'person',
      description: 'test',
      sources: [],
    })
    expect(person.success).toBe(true)

    const location = EntitySchema.safeParse({
      id: 'test',
      name: 'Test',
      entityType: 'location',
      description: 'test',
      locationType: 'city',
      coordinates: { lat: 41.9, lng: 12.5 },
      sources: [],
    })
    expect(location.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/data/schemas/schemas.test.ts
```

Expected: FAIL — modules don't exist yet.

- [ ] **Step 3: Implement base schema**

```typescript
// src/data/schemas/base.ts
import { z } from 'zod'

export const EntityTypeSchema = z.enum([
  'person',
  'organization',
  'event',
  'location',
  'document',
  'legion',
  'dynasty',
  'religion',
  'tradeGood',
  'infrastructure',
])

export const EntityBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  yearStart: z.number().optional(),
  yearEnd: z.number().optional(),
  region: z.string().optional(),
  sources: z.array(z.string()),
  imageUrl: z.string().url().optional(),
})
```

- [ ] **Step 4: Implement all entity schemas**

```typescript
// src/data/schemas/person.ts
import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const PersonSchema = EntityBaseSchema.extend({
  entityType: z.literal('person'),
  born: z.number().optional(),
  died: z.number().optional(),
  roles: z.array(z.string()).default([]),
  faction: z.string().optional(),
})
```

```typescript
// src/data/schemas/organization.ts
import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const OrganizationSchema = EntityBaseSchema.extend({
  entityType: z.literal('organization'),
  founded: z.number().optional(),
  dissolved: z.number().optional(),
  orgType: z.string().optional(),
})
```

```typescript
// src/data/schemas/event.ts
import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const EventSchema = EntityBaseSchema.extend({
  entityType: z.literal('event'),
  date: z.number().optional(),
  endDate: z.number().optional(),
  eventType: z.string().optional(),
})
```

```typescript
// src/data/schemas/location.ts
import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const LocationSchema = EntityBaseSchema.extend({
  entityType: z.literal('location'),
  locationType: z.string().optional(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  province: z.string().optional(),
})
```

```typescript
// src/data/schemas/document.ts
import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const DocumentSchema = EntityBaseSchema.extend({
  entityType: z.literal('document'),
  date: z.number().optional(),
  author: z.string().optional(),
  docType: z.string().optional(),
})
```

```typescript
// src/data/schemas/legion.ts
import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const LegionSchema = EntityBaseSchema.extend({
  entityType: z.literal('legion'),
  founded: z.number().optional(),
  disbanded: z.number().optional(),
  symbol: z.string().optional(),
  homeBase: z.string().optional(),
})
```

```typescript
// src/data/schemas/dynasty.ts
import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const DynastySchema = EntityBaseSchema.extend({
  entityType: z.literal('dynasty'),
  founder: z.string().optional(),
  startYear: z.number().optional(),
  endYear: z.number().optional(),
})
```

```typescript
// src/data/schemas/religion.ts
import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const ReligionSchema = EntityBaseSchema.extend({
  entityType: z.literal('religion'),
  origin: z.string().optional(),
  deities: z.array(z.string()).default([]),
})
```

```typescript
// src/data/schemas/trade-good.ts
import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const TradeGoodSchema = EntityBaseSchema.extend({
  entityType: z.literal('tradeGood'),
  origins: z.array(z.string()).default([]),
  destinations: z.array(z.string()).default([]),
})
```

```typescript
// src/data/schemas/infrastructure.ts
import { z } from 'zod'
import { EntityBaseSchema } from './base'

export const InfrastructureSchema = EntityBaseSchema.extend({
  entityType: z.literal('infrastructure'),
  builtBy: z.string().optional(),
  builtYear: z.number().optional(),
  infraType: z.string().optional(),
})
```

- [ ] **Step 5: Implement connection and story schemas**

```typescript
// src/data/schemas/connection.ts
import { z } from 'zod'

export const ConnectionTypeSchema = z.enum([
  // Political
  'alliance',
  'opposition',
  'faction',
  'succession',
  'assassination',
  'appointment',
  // Military
  'commanded',
  'served_in',
  'battle_participation',
  'campaign',
  'defeated',
  // Social
  'family',
  'mentorship',
  'patronage',
  'rivalry',
  'marriage',
  // Geographic
  'located_in',
  'governed',
  'trade_route',
  'military_route',
  // Cultural
  'authored',
  'dedicated_to',
  'worship',
  'built',
  'founded',
])

export const ConnectionSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  connectionType: ConnectionTypeSchema,
  strength: z.number().int().min(1).max(3),
  year: z.number().optional(),
  endYear: z.number().optional(),
  evidence: z.string(),
  sources: z.array(z.string()),
})
```

```typescript
// src/data/schemas/story.ts
import { z } from 'zod'

export const StoryStepSchema = z.object({
  entityId: z.string(),
  text: z.string(),
  highlightConnections: z.array(z.string()).default([]),
})

export const StorySchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string(),
  steps: z.array(StoryStepSchema).min(1),
  coverImage: z.string().optional(),
})
```

```typescript
// src/data/schemas/territory.ts
import { z } from 'zod'

export const TerritoryStatusSchema = z.enum(['core', 'province', 'client', 'contested', 'lost'])

export const TerritorySnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  year: z.number(),
  boundaries: z.any(), // GeoJSON Feature — validated structurally at load time
  controlledBy: z.string().optional(),
  status: TerritoryStatusSchema,
})
```

- [ ] **Step 6: Create barrel export with discriminated union**

```typescript
// src/data/schemas/index.ts
export { EntityTypeSchema, EntityBaseSchema } from './base'
export { PersonSchema } from './person'
export { OrganizationSchema } from './organization'
export { EventSchema } from './event'
export { LocationSchema } from './location'
export { DocumentSchema } from './document'
export { LegionSchema } from './legion'
export { DynastySchema } from './dynasty'
export { ReligionSchema } from './religion'
export { TradeGoodSchema } from './trade-good'
export { InfrastructureSchema } from './infrastructure'
export { ConnectionSchema, ConnectionTypeSchema } from './connection'
export { StorySchema, StoryStepSchema } from './story'
export { TerritorySnapshotSchema, TerritoryStatusSchema } from './territory'

import { z } from 'zod'
import { PersonSchema } from './person'
import { OrganizationSchema } from './organization'
import { EventSchema } from './event'
import { LocationSchema } from './location'
import { DocumentSchema } from './document'
import { LegionSchema } from './legion'
import { DynastySchema } from './dynasty'
import { ReligionSchema } from './religion'
import { TradeGoodSchema } from './trade-good'
import { InfrastructureSchema } from './infrastructure'

export const EntitySchema = z.discriminatedUnion('entityType', [
  PersonSchema,
  OrganizationSchema,
  EventSchema,
  LocationSchema,
  DocumentSchema,
  LegionSchema,
  DynastySchema,
  ReligionSchema,
  TradeGoodSchema,
  InfrastructureSchema,
])
```

- [ ] **Step 7: Run tests**

```bash
npm test -- src/data/schemas/schemas.test.ts
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/data/schemas/
git commit -m "feat: add Zod schemas for all 10 entity types, connections, stories, territories"
```

---

### Task 8: Create shared TypeScript types (inferred from Zod)

**Files:**

- Create: `src/types/index.ts`

- [ ] **Step 1: Create inferred types**

```typescript
// src/types/index.ts
import { z } from 'zod'
import type * as d3 from 'd3'
import {
  EntitySchema,
  PersonSchema,
  OrganizationSchema,
  EventSchema,
  LocationSchema,
  DocumentSchema,
  LegionSchema,
  DynastySchema,
  ReligionSchema,
  TradeGoodSchema,
  InfrastructureSchema,
  ConnectionSchema,
  ConnectionTypeSchema,
  EntityTypeSchema,
  StorySchema,
  StoryStepSchema,
  TerritorySnapshotSchema,
} from '@/data/schemas'

// Entity types
export type EntityType = z.infer<typeof EntityTypeSchema>
export type Person = z.infer<typeof PersonSchema>
export type Organization = z.infer<typeof OrganizationSchema>
export type Event = z.infer<typeof EventSchema>
export type Location = z.infer<typeof LocationSchema>
export type Document = z.infer<typeof DocumentSchema>
export type Legion = z.infer<typeof LegionSchema>
export type Dynasty = z.infer<typeof DynastySchema>
export type Religion = z.infer<typeof ReligionSchema>
export type TradeGood = z.infer<typeof TradeGoodSchema>
export type Infrastructure = z.infer<typeof InfrastructureSchema>
export type Entity = z.infer<typeof EntitySchema>

// Connection types
export type ConnectionType = z.infer<typeof ConnectionTypeSchema>
export type Connection = z.infer<typeof ConnectionSchema>

// Story types
export type Story = z.infer<typeof StorySchema>
export type StoryStep = z.infer<typeof StoryStepSchema>

// Territory types
export type TerritorySnapshot = z.infer<typeof TerritorySnapshotSchema>

// Graph visualization types (D3)
export interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  entityType: EntityType
  radius: number
}

export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string
  connectionType: ConnectionType
  strength: number
}

// Filter state
export interface FilterState {
  entityTypes: EntityType[]
  connectionTypes: ConnectionType[]
  regions: string[]
  yearRange: [number, number]
  searchQuery: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/
git commit -m "feat: add TypeScript types inferred from Zod schemas"
```

---

### Task 9: Create data loader with validation

**Files:**

- Create: `src/data/loader.ts`
- Create: `src/data/index.ts`
- Create: `src/data/entities/` (empty JSON seed files)
- Test: `src/data/loader.test.ts`

- [ ] **Step 1: Write loader test**

```typescript
// src/data/loader.test.ts
import { describe, it, expect } from 'vitest'
import { loadAndValidateData } from './loader'

describe('loadAndValidateData', () => {
  it('loads and validates all seed data without errors', () => {
    const data = loadAndValidateData()
    // Will become toBeGreaterThan(0) once seed data is added in Task 25
    expect(data.entities.length).toBeGreaterThanOrEqual(0)
    expect(data.connections.length).toBeGreaterThanOrEqual(0)
    expect(data.stories.length).toBeGreaterThanOrEqual(0)
  })

  it('ensures referential integrity — all connection endpoints exist', () => {
    const data = loadAndValidateData()
    const entityIds = new Set(data.entities.map((e) => e.id))
    for (const conn of data.connections) {
      expect(entityIds.has(conn.source), `Missing source: ${conn.source}`).toBe(true)
      expect(entityIds.has(conn.target), `Missing target: ${conn.target}`).toBe(true)
    }
  })

  it('ensures no duplicate IDs', () => {
    const data = loadAndValidateData()
    const ids = data.entities.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
```

- [ ] **Step 2: Implement loader**

```typescript
// src/data/loader.ts
import { EntitySchema, ConnectionSchema, StorySchema, TerritorySnapshotSchema } from './schemas'
import type { Entity, Connection, Story, TerritorySnapshot } from '@/types'

import peopleJson from './entities/people.json'
import eventsJson from './entities/events.json'
import locationsJson from './entities/locations.json'
import organizationsJson from './entities/organizations.json'
import documentsJson from './entities/documents.json'
import legionsJson from './entities/legions.json'
import dynastiesJson from './entities/dynasties.json'
import religionsJson from './entities/religions.json'
import tradeGoodsJson from './entities/trade-goods.json'
import infrastructureJson from './entities/infrastructure.json'
import connectionsJson from './entities/connections.json'
import storiesJson from './stories/stories.json'
import territoriesJson from './territories/territories.json'

function validateArray<T>(
  data: unknown[],
  schema: { parse: (d: unknown) => T },
  label: string,
): T[] {
  return data.map((item, i) => {
    try {
      return schema.parse(item)
    } catch (e) {
      throw new Error(`Validation failed for ${label}[${i}]: ${e}`)
    }
  })
}

export function loadAndValidateData() {
  const entities: Entity[] = [
    ...validateArray(peopleJson, EntitySchema, 'people'),
    ...validateArray(eventsJson, EntitySchema, 'events'),
    ...validateArray(locationsJson, EntitySchema, 'locations'),
    ...validateArray(organizationsJson, EntitySchema, 'organizations'),
    ...validateArray(documentsJson, EntitySchema, 'documents'),
    ...validateArray(legionsJson, EntitySchema, 'legions'),
    ...validateArray(dynastiesJson, EntitySchema, 'dynasties'),
    ...validateArray(religionsJson, EntitySchema, 'religions'),
    ...validateArray(tradeGoodsJson, EntitySchema, 'trade-goods'),
    ...validateArray(infrastructureJson, EntitySchema, 'infrastructure'),
  ]

  const connections = validateArray(connectionsJson, ConnectionSchema, 'connections')
  const stories = validateArray(storiesJson, StorySchema, 'stories')
  const territories = validateArray(territoriesJson, TerritorySnapshotSchema, 'territories')

  // Referential integrity check
  const entityIds = new Set(entities.map((e) => e.id))
  for (const conn of connections) {
    if (!entityIds.has(conn.source)) {
      console.warn(`Connection ${conn.id}: source "${conn.source}" not found`)
    }
    if (!entityIds.has(conn.target)) {
      console.warn(`Connection ${conn.id}: target "${conn.target}" not found`)
    }
  }

  return { entities, connections, stories, territories }
}
```

```typescript
// src/data/index.ts
import { loadAndValidateData } from './loader'

const data = loadAndValidateData()

export const entities = data.entities
export const connections = data.connections
export const stories = data.stories
export const territories = data.territories
```

- [ ] **Step 3: Create minimal seed JSON files**

Create `src/data/entities/people.json`, `events.json`, `locations.json`, `organizations.json`, `documents.json`, `legions.json`, `dynasties.json`, `religions.json`, `trade-goods.json`, `infrastructure.json`, `connections.json` — each with `[]` (empty arrays for now; seed data is Task 25 in Chunk 4).

Create `src/data/stories/stories.json` with `[]`.
Create `src/data/territories/territories.json` with `[]`.

- [ ] **Step 4: Run tests**

```bash
npm test -- src/data/loader.test.ts
```

Note: The "loads data" test will fail because entities are empty. Update the test expectation to `toBeGreaterThanOrEqual(0)` for now — the seed data task (Task 14) will populate the files.

- [ ] **Step 5: Commit**

```bash
git add src/data/
git commit -m "feat: add data loader with Zod validation and referential integrity checks"
```

---

### Task 10: Create Zustand stores

**Files:**

- Create: `src/stores/useSelectionStore.ts`
- Create: `src/stores/useFilterStore.ts`
- Create: `src/stores/useUIStore.ts`
- Create: `src/stores/useTimelineStore.ts`
- Test: `src/stores/stores.test.ts`

- [ ] **Step 1: Write store tests**

```typescript
// src/stores/stores.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useSelectionStore } from './useSelectionStore'
import { useFilterStore } from './useFilterStore'
import { useUIStore } from './useUIStore'
import { useTimelineStore } from './useTimelineStore'

describe('useSelectionStore', () => {
  beforeEach(() => useSelectionStore.setState(useSelectionStore.getInitialState()))

  it('selects an entity', () => {
    useSelectionStore.getState().select('julius-caesar')
    expect(useSelectionStore.getState().selectedId).toBe('julius-caesar')
  })

  it('adds to breadcrumbs on select', () => {
    useSelectionStore.getState().select('julius-caesar')
    useSelectionStore.getState().select('pompey')
    expect(useSelectionStore.getState().breadcrumbs).toEqual(['julius-caesar', 'pompey'])
  })

  it('pins and unpins entities', () => {
    useSelectionStore.getState().pin('julius-caesar')
    expect(useSelectionStore.getState().pinnedIds).toContain('julius-caesar')
    useSelectionStore.getState().unpin('julius-caesar')
    expect(useSelectionStore.getState().pinnedIds).not.toContain('julius-caesar')
  })
})

describe('useFilterStore', () => {
  beforeEach(() => useFilterStore.setState(useFilterStore.getInitialState()))

  it('sets a filter', () => {
    useFilterStore.getState().setFilter('searchQuery', 'caesar')
    expect(useFilterStore.getState().searchQuery).toBe('caesar')
  })

  it('saves and restores snapshots', () => {
    useFilterStore.getState().setFilter('searchQuery', 'caesar')
    useFilterStore.getState().saveSnapshot()
    useFilterStore.getState().setFilter('searchQuery', 'pompey')
    useFilterStore.getState().restoreSnapshot()
    expect(useFilterStore.getState().searchQuery).toBe('caesar')
  })

  it('resets filters', () => {
    useFilterStore.getState().setFilter('searchQuery', 'caesar')
    useFilterStore.getState().resetFilters()
    expect(useFilterStore.getState().searchQuery).toBe('')
  })
})

describe('useUIStore', () => {
  beforeEach(() => useUIStore.setState(useUIStore.getInitialState()))

  it('switches lens', () => {
    useUIStore.getState().switchLens('map')
    expect(useUIStore.getState().lens).toBe('map')
  })
})

describe('useTimelineStore', () => {
  beforeEach(() => useTimelineStore.setState(useTimelineStore.getInitialState()))

  it('sets year', () => {
    useTimelineStore.getState().setYear(-44)
    expect(useTimelineStore.getState().currentYear).toBe(-44)
  })

  it('toggles play/pause', () => {
    useTimelineStore.getState().play()
    expect(useTimelineStore.getState().playing).toBe(true)
    useTimelineStore.getState().pause()
    expect(useTimelineStore.getState().playing).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/stores/stores.test.ts
```

Expected: FAIL — stores don't exist yet.

- [ ] **Step 3: Implement selection store**

```typescript
// src/stores/useSelectionStore.ts
import { create } from 'zustand'

interface SelectionState {
  selectedId: string | null
  hoveredId: string | null
  breadcrumbs: string[]
  pinnedIds: string[]
  select: (id: string | null) => void
  hover: (id: string | null) => void
  pin: (id: string) => void
  unpin: (id: string) => void
  clearTrail: () => void
}

const MAX_BREADCRUMBS = 50

export const useSelectionStore = create<SelectionState>()((set) => ({
  selectedId: null,
  hoveredId: null,
  breadcrumbs: [],
  pinnedIds: [],
  select: (id) =>
    set((state) => ({
      selectedId: id,
      breadcrumbs: id ? [...state.breadcrumbs, id].slice(-MAX_BREADCRUMBS) : state.breadcrumbs,
    })),
  hover: (id) => set({ hoveredId: id }),
  pin: (id) =>
    set((state) => ({
      pinnedIds: state.pinnedIds.includes(id) ? state.pinnedIds : [...state.pinnedIds, id],
    })),
  unpin: (id) =>
    set((state) => ({
      pinnedIds: state.pinnedIds.filter((p) => p !== id),
    })),
  clearTrail: () => set({ breadcrumbs: [], pinnedIds: [] }),
}))
```

- [ ] **Step 4: Implement filter store**

```typescript
// src/stores/useFilterStore.ts
import { create } from 'zustand'
import type { EntityType, ConnectionType, FilterState } from '@/types'

interface FilterStoreState extends FilterState {
  snapshot: FilterState | null
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  resetFilters: () => void
  saveSnapshot: () => void
  restoreSnapshot: () => void
}

const initialFilters: FilterState = {
  entityTypes: [],
  connectionTypes: [],
  regions: [],
  yearRange: [-753, 476],
  searchQuery: '',
}

export const useFilterStore = create<FilterStoreState>()((set, get) => ({
  ...initialFilters,
  snapshot: null,
  setFilter: (key, value) => set({ [key]: value }),
  resetFilters: () => set({ ...initialFilters }),
  saveSnapshot: () => {
    const { entityTypes, connectionTypes, regions, yearRange, searchQuery } = get()
    set({ snapshot: { entityTypes, connectionTypes, regions, yearRange, searchQuery } })
  },
  restoreSnapshot: () => {
    const { snapshot } = get()
    if (snapshot) set({ ...snapshot, snapshot: null })
  },
}))
```

- [ ] **Step 5: Implement UI store**

```typescript
// src/stores/useUIStore.ts
import { create } from 'zustand'

type Lens = 'graph' | 'map' | 'timeline' | 'stats'

interface UIState {
  lens: Lens
  detailPanelOpen: boolean
  sidebarOpen: boolean
  isMobile: boolean
  switchLens: (lens: Lens) => void
  toggleDetail: () => void
  toggleSidebar: () => void
  setMobile: (isMobile: boolean) => void
}

export const useUIStore = create<UIState>()((set) => ({
  lens: 'graph',
  detailPanelOpen: false,
  sidebarOpen: true,
  isMobile: false,
  switchLens: (lens) => set({ lens }),
  toggleDetail: () => set((s) => ({ detailPanelOpen: !s.detailPanelOpen })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setMobile: (isMobile) => set({ isMobile }),
}))
```

- [ ] **Step 6: Implement timeline store**

```typescript
// src/stores/useTimelineStore.ts
import { create } from 'zustand'

interface TimelineState {
  playing: boolean
  currentYear: number
  speed: number
  isScrubbing: boolean
  play: () => void
  pause: () => void
  setYear: (year: number) => void
  setSpeed: (speed: number) => void
  setScrubbing: (isScrubbing: boolean) => void
}

export const useTimelineStore = create<TimelineState>()((set) => ({
  playing: false,
  currentYear: -753,
  speed: 1,
  isScrubbing: false,
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  setYear: (year) => set({ currentYear: year }),
  setSpeed: (speed) => set({ speed }),
  setScrubbing: (isScrubbing) => set({ isScrubbing }),
}))
```

- [ ] **Step 7: Run tests**

```bash
npm test -- src/stores/stores.test.ts
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/stores/
git commit -m "feat: add Zustand stores for selection, filters, UI, and timeline"
```

---

### Task 11: Create utility libraries

**Files:**

- Create: `src/lib/pathfinding.ts`
- Create: `src/lib/colors.ts`
- Create: `src/lib/geo.ts`
- Create: `src/lib/filtering.ts`
- Test: `src/lib/pathfinding.test.ts`
- Test: `src/lib/filtering.test.ts`

- [ ] **Step 1: Write pathfinding tests**

```typescript
// src/lib/pathfinding.test.ts
import { describe, it, expect } from 'vitest'
import { findShortestPath } from './pathfinding'
import type { Connection } from '@/types'

const connections: Connection[] = [
  {
    id: 'c1',
    source: 'a',
    target: 'b',
    connectionType: 'alliance',
    strength: 1,
    evidence: '',
    sources: [],
  },
  {
    id: 'c2',
    source: 'b',
    target: 'c',
    connectionType: 'alliance',
    strength: 1,
    evidence: '',
    sources: [],
  },
  {
    id: 'c3',
    source: 'a',
    target: 'c',
    connectionType: 'opposition',
    strength: 1,
    evidence: '',
    sources: [],
  },
]

describe('findShortestPath', () => {
  it('finds direct connection', () => {
    const path = findShortestPath('a', 'b', connections)
    expect(path).toHaveLength(1)
    expect(path![0].connection.id).toBe('c1')
  })

  it('finds shortest path over direct alternative', () => {
    const path = findShortestPath('a', 'c', connections)
    expect(path).toHaveLength(1) // direct a→c exists
  })

  it('returns null for disconnected nodes', () => {
    const path = findShortestPath('a', 'z', connections)
    expect(path).toBeNull()
  })
})
```

- [ ] **Step 2: Implement pathfinding (BFS)**

```typescript
// src/lib/pathfinding.ts
import type { Connection } from '@/types'

export interface PathStep {
  entityId: string
  connection: Connection
}

export function findShortestPath(
  startId: string,
  endId: string,
  connections: Connection[],
): PathStep[] | null {
  if (startId === endId) return []

  const adjacency = new Map<string, { neighbor: string; connection: Connection }[]>()
  for (const conn of connections) {
    if (!adjacency.has(conn.source)) adjacency.set(conn.source, [])
    if (!adjacency.has(conn.target)) adjacency.set(conn.target, [])
    adjacency.get(conn.source)!.push({ neighbor: conn.target, connection: conn })
    adjacency.get(conn.target)!.push({ neighbor: conn.source, connection: conn })
  }

  const visited = new Set<string>([startId])
  const queue: { id: string; path: PathStep[] }[] = [{ id: startId, path: [] }]

  while (queue.length > 0) {
    const { id, path } = queue.shift()!
    for (const { neighbor, connection } of adjacency.get(id) ?? []) {
      if (visited.has(neighbor)) continue
      const newPath = [...path, { entityId: neighbor, connection }]
      if (neighbor === endId) return newPath
      visited.add(neighbor)
      queue.push({ id: neighbor, path: newPath })
    }
  }

  return null
}
```

- [ ] **Step 3: Implement colors utility**

```typescript
// src/lib/colors.ts
import type { EntityType, ConnectionType } from '@/types'

export const entityColors: Record<EntityType, string> = {
  person: 'var(--color-entity-person)',
  organization: 'var(--color-entity-organization)',
  event: 'var(--color-entity-event)',
  location: 'var(--color-entity-location)',
  document: 'var(--color-entity-document)',
  legion: 'var(--color-entity-legion)',
  dynasty: 'var(--color-entity-dynasty)',
  religion: 'var(--color-entity-religion)',
  tradeGood: 'var(--color-entity-trade-good)',
  infrastructure: 'var(--color-entity-infrastructure)',
}

export const entityLabels: Record<EntityType, string> = {
  person: 'Person',
  organization: 'Organization',
  event: 'Event',
  location: 'Location',
  document: 'Document',
  legion: 'Legion',
  dynasty: 'Dynasty',
  religion: 'Religion',
  tradeGood: 'Trade Good',
  infrastructure: 'Infrastructure',
}

export const connectionCategoryColors: Record<string, string> = {
  political: '#e74c3c',
  military: '#c0392b',
  social: '#2ecc71',
  geographic: '#3498db',
  cultural: '#f39c12',
}

export function getConnectionCategory(type: ConnectionType): string {
  const political = [
    'alliance',
    'opposition',
    'faction',
    'succession',
    'assassination',
    'appointment',
  ]
  const military = ['commanded', 'served_in', 'battle_participation', 'campaign', 'defeated']
  const social = ['family', 'mentorship', 'patronage', 'rivalry', 'marriage']
  const geographic = ['located_in', 'governed', 'trade_route', 'military_route']
  if (political.includes(type)) return 'political'
  if (military.includes(type)) return 'military'
  if (social.includes(type)) return 'social'
  if (geographic.includes(type)) return 'geographic'
  return 'cultural'
}
```

- [ ] **Step 4: Implement filtering utility**

```typescript
// src/lib/filtering.ts
import type { Entity, Connection, FilterState } from '@/types'

export function filterEntities(
  entities: Entity[],
  filters: FilterState,
  timelineYear?: number,
): Entity[] {
  return entities.filter((entity) => {
    if (filters.entityTypes.length > 0 && !filters.entityTypes.includes(entity.entityType)) {
      return false
    }
    if (filters.regions.length > 0 && entity.region && !filters.regions.includes(entity.region)) {
      return false
    }
    if (entity.yearStart != null && entity.yearStart > filters.yearRange[1]) return false
    if (entity.yearEnd != null && entity.yearEnd < filters.yearRange[0]) return false
    if (timelineYear != null) {
      if (entity.yearStart != null && entity.yearStart > timelineYear) return false
      if (entity.yearEnd != null && entity.yearEnd < timelineYear) return false
    }
    return true
  })
}

export function filterConnections(
  connections: Connection[],
  entityIds: Set<string>,
  filters: FilterState,
): Connection[] {
  return connections.filter((conn) => {
    if (!entityIds.has(conn.source) || !entityIds.has(conn.target)) return false
    if (
      filters.connectionTypes.length > 0 &&
      !filters.connectionTypes.includes(conn.connectionType)
    ) {
      return false
    }
    return true
  })
}
```

- [ ] **Step 5: Write filtering test**

```typescript
// src/lib/filtering.test.ts
import { describe, it, expect } from 'vitest'
import { filterEntities, filterConnections } from './filtering'
import type { Entity, Connection, FilterState } from '@/types'

const entities: Entity[] = [
  {
    id: 'caesar',
    name: 'Caesar',
    entityType: 'person',
    description: '',
    yearStart: -100,
    yearEnd: -44,
    sources: [],
  } as Entity,
  {
    id: 'rome',
    name: 'Rome',
    entityType: 'location',
    description: '',
    locationType: 'city',
    sources: [],
  } as Entity,
]

const defaultFilters: FilterState = {
  entityTypes: [],
  connectionTypes: [],
  regions: [],
  yearRange: [-753, 476],
  searchQuery: '',
}

describe('filterEntities', () => {
  it('returns all entities with no filters', () => {
    expect(filterEntities(entities, defaultFilters)).toHaveLength(2)
  })

  it('filters by entity type', () => {
    const result = filterEntities(entities, { ...defaultFilters, entityTypes: ['person'] })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('caesar')
  })

  it('filters by timeline year', () => {
    const result = filterEntities(entities, defaultFilters, -200)
    // Caesar not born yet at -200
    expect(result.find((e) => e.id === 'caesar')).toBeUndefined()
  })
})
```

- [ ] **Step 6: Create geo utility stub**

```typescript
// src/lib/geo.ts
export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lngDir = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lng).toFixed(2)}°${lngDir}`
}

export function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`
  return `${year} AD`
}
```

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/
git commit -m "feat: add utility libraries — pathfinding, colors, filtering, geo"
```

---

## Chunk 2: App Shell & Core UI Features

### Task 12: App routing and layout shell

**Files:**

- Modify: `src/app/App.tsx` (move from `src/App.tsx`)
- Create: `src/app/Layout.tsx`
- Create: `src/app/providers.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create providers wrapper**

```typescript
// src/app/providers.tsx
import { BrowserRouter } from 'react-router-dom'

export function Providers({ children }: { children: React.ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>
}
```

- [ ] **Step 2: Create Layout component**

```typescript
// src/app/Layout.tsx
import { Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <Outlet />
    </div>
  )
}
```

- [ ] **Step 3: Create App with routes**

```typescript
// src/app/App.tsx
import { Routes, Route } from 'react-router-dom'
import { Layout } from './Layout'

import { InvestigationBoard } from '@/features/board/InvestigationBoard'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<InvestigationBoard />} />
        <Route path="/investigate" element={<InvestigationBoard />} />
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 4: Update main.tsx**

```typescript
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Providers } from './app/providers'
import { App } from './app/App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)
```

- [ ] **Step 5: Commit**

```bash
git add src/app/ src/main.tsx
git commit -m "feat: add app shell with routing and layout"
```

---

### Task 13: InvestigationBoard — slim orchestrator

**Files:**

- Create: `src/features/board/InvestigationBoard.tsx`
- Create: `src/features/board/TopBar.tsx`
- Create: `src/features/board/TrailBar.tsx`
- Create: `src/features/board/LensSwitcher.tsx`

- [ ] **Step 1: Create InvestigationBoard**

```typescript
// src/features/board/InvestigationBoard.tsx
import { useUIStore } from '@/stores/useUIStore'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { TopBar } from './TopBar'
import { TrailBar } from './TrailBar'

export function InvestigationBoard() {
  const lens = useUIStore((s) => s.lens)
  const selectedId = useSelectionStore((s) => s.selectedId)

  return (
    <div className="flex flex-col h-screen">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 relative">
          {lens === 'graph' && <div className="flex items-center justify-center h-full text-text-secondary">Graph View (coming soon)</div>}
          {lens === 'map' && <div className="flex items-center justify-center h-full text-text-secondary">Map View (coming soon)</div>}
          {lens === 'timeline' && <div className="flex items-center justify-center h-full text-text-secondary">Timeline View (coming soon)</div>}
          {lens === 'stats' && <div className="flex items-center justify-center h-full text-text-secondary">Stats View (coming soon)</div>}
        </main>
        {selectedId && (
          <aside className="w-[340px] border-l border-border bg-bg-secondary overflow-y-auto">
            <div className="p-4 text-text-secondary">Detail Panel (coming soon)</div>
          </aside>
        )}
      </div>
      <TrailBar />
    </div>
  )
}
```

- [ ] **Step 2: Create TopBar**

```typescript
// src/features/board/TopBar.tsx
import { LensSwitcher } from './LensSwitcher'

export function TopBar() {
  return (
    <header className="h-12 border-b border-border bg-bg-secondary flex items-center px-4 gap-4">
      <h1 className="text-accent-gold font-bold text-lg">Ancient Rome</h1>
      <div className="flex-1" />
      <LensSwitcher />
    </header>
  )
}
```

- [ ] **Step 3: Create LensSwitcher**

```typescript
// src/features/board/LensSwitcher.tsx
import { useUIStore } from '@/stores/useUIStore'
import { Button } from '@/ui/button'

const lenses = [
  { id: 'graph' as const, label: 'Graph' },
  { id: 'map' as const, label: 'Map' },
  { id: 'timeline' as const, label: 'Timeline' },
  { id: 'stats' as const, label: 'Stats' },
]

export function LensSwitcher() {
  const lens = useUIStore((s) => s.lens)
  const switchLens = useUIStore((s) => s.switchLens)

  return (
    <div className="flex gap-1">
      {lenses.map((l) => (
        <Button
          key={l.id}
          variant={lens === l.id ? 'default' : 'ghost'}
          size="sm"
          onClick={() => switchLens(l.id)}
        >
          {l.label}
        </Button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create TrailBar**

```typescript
// src/features/board/TrailBar.tsx
import { useSelectionStore } from '@/stores/useSelectionStore'
import { entities } from '@/data'
import { Badge } from '@/ui/badge'

export function TrailBar() {
  const breadcrumbs = useSelectionStore((s) => s.breadcrumbs)
  const select = useSelectionStore((s) => s.select)

  if (breadcrumbs.length === 0) return null

  const recent = breadcrumbs.slice(-8)

  return (
    <div className="h-10 border-t border-border bg-bg-secondary flex items-center px-4 gap-2 overflow-x-auto">
      <span className="text-xs text-text-secondary shrink-0">Trail:</span>
      {recent.map((id, i) => {
        const entity = entities.find((e) => e.id === id)
        return (
          <Badge
            key={`${id}-${i}`}
            variant="outline"
            className="cursor-pointer shrink-0"
            onClick={() => select(id)}
          >
            {entity?.name ?? id}
          </Badge>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Verify app renders**

```bash
npm run dev
```

Expected: Dark background, gold "Ancient Rome" title, lens switcher with Graph/Map/Timeline/Stats buttons, placeholder text for active lens.

- [ ] **Step 6: Commit**

```bash
git add src/features/board/
git commit -m "feat: add InvestigationBoard shell with TopBar, LensSwitcher, TrailBar"
```

---

### Task 14: Search feature

**Files:**

- Create: `src/features/search/SearchBar.tsx`
- Create: `src/features/search/PathFinder.tsx`

- [ ] **Step 1: Create SearchBar with Fuse.js**

```typescript
// src/features/search/SearchBar.tsx
import { useState, useMemo, useRef, useEffect } from 'react'
import Fuse from 'fuse.js'
import { entities } from '@/data'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useFilterStore } from '@/stores/useFilterStore'
import { Input } from '@/ui/input'
import type { Entity } from '@/types'

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const select = useSelectionStore((s) => s.select)
  const setFilter = useFilterStore((s) => s.setFilter)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const fuse = useMemo(
    () => new Fuse(entities, { keys: ['name', 'description'], threshold: 0.3 }),
    [],
  )

  const results = useMemo(() => {
    if (!query.trim()) return []
    return fuse.search(query, { limit: 8 }).map((r) => r.item)
  }, [query, fuse])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(entity: Entity) {
    select(entity.id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative w-64">
      <Input
        placeholder="Search entities..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setFilter('searchQuery', e.target.value)
          setOpen(true)
        }}
        onFocus={() => query && setOpen(true)}
        className="bg-bg-primary border-border text-text-primary"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-bg-card border border-border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
          {results.map((entity) => (
            <button
              key={entity.id}
              className="w-full text-left px-3 py-2 hover:bg-bg-secondary text-sm text-text-primary flex items-center gap-2"
              onClick={() => handleSelect(entity)}
            >
              <span className="text-xs text-text-secondary">{entity.entityType}</span>
              <span>{entity.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create PathFinder**

```typescript
// src/features/search/PathFinder.tsx
import { useState } from 'react'
import { findShortestPath } from '@/lib/pathfinding'
import { connections, entities } from '@/data'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'

export function PathFinder() {
  const [startQuery, setStartQuery] = useState('')
  const [endQuery, setEndQuery] = useState('')
  const [result, setResult] = useState<ReturnType<typeof findShortestPath>>(null)
  const [error, setError] = useState('')
  const select = useSelectionStore((s) => s.select)

  function handleFind() {
    const startEntity = entities.find(
      (e) => e.name.toLowerCase().includes(startQuery.toLowerCase()),
    )
    const endEntity = entities.find(
      (e) => e.name.toLowerCase().includes(endQuery.toLowerCase()),
    )

    if (!startEntity || !endEntity) {
      setError('Could not find one or both entities')
      setResult(null)
      return
    }

    const path = findShortestPath(startEntity.id, endEntity.id, connections)
    if (!path) {
      setError('No path found between these entities')
      setResult(null)
      return
    }

    setResult(path)
    setError('')
  }

  return (
    <div className="p-4 space-y-3">
      <h3 className="font-semibold text-sm">PathFinder</h3>
      <Input
        placeholder="Start entity..."
        value={startQuery}
        onChange={(e) => setStartQuery(e.target.value)}
        className="bg-bg-primary border-border text-text-primary"
      />
      <Input
        placeholder="End entity..."
        value={endQuery}
        onChange={(e) => setEndQuery(e.target.value)}
        className="bg-bg-primary border-border text-text-primary"
      />
      <Button size="sm" onClick={handleFind}>
        Find Path
      </Button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {result && (
        <div className="space-y-1">
          <p className="text-xs text-text-secondary">{result.length} step(s)</p>
          {result.map((step, i) => {
            const entity = entities.find((e) => e.id === step.entityId)
            return (
              <button
                key={i}
                className="block w-full text-left text-sm px-2 py-1 rounded hover:bg-bg-secondary text-text-primary"
                onClick={() => select(step.entityId)}
              >
                → {entity?.name ?? step.entityId}
                <span className="text-xs text-text-secondary ml-2">
                  ({step.connection.connectionType})
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add SearchBar to TopBar**

Update `src/features/board/TopBar.tsx` to import and render `<SearchBar />` between the title and flex spacer.

- [ ] **Step 4: Commit**

```bash
git add src/features/search/ src/features/board/TopBar.tsx
git commit -m "feat: add SearchBar with Fuse.js and PathFinder with BFS"
```

---

### Task 15: Filter feature

**Files:**

- Create: `src/features/filters/FilterPanel.tsx`
- Create: `src/features/filters/EntityTypeFilter.tsx`
- Create: `src/features/filters/ConnectionTypeFilter.tsx`
- Create: `src/features/filters/TimePeriodFilter.tsx`

- [ ] **Step 1: Create EntityTypeFilter**

```typescript
// src/features/filters/EntityTypeFilter.tsx
import { useFilterStore } from '@/stores/useFilterStore'
import { entityLabels, entityColors } from '@/lib/colors'
import type { EntityType } from '@/types'

const allTypes: EntityType[] = [
  'person', 'organization', 'event', 'location', 'document',
  'legion', 'dynasty', 'religion', 'tradeGood', 'infrastructure',
]

export function EntityTypeFilter() {
  const entityTypes = useFilterStore((s) => s.entityTypes)
  const setFilter = useFilterStore((s) => s.setFilter)

  function toggle(type: EntityType) {
    const next = entityTypes.includes(type)
      ? entityTypes.filter((t) => t !== type)
      : [...entityTypes, type]
    setFilter('entityTypes', next)
  }

  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold text-text-secondary uppercase">Entity Types</h4>
      {allTypes.map((type) => (
        <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={entityTypes.length === 0 || entityTypes.includes(type)}
            onChange={() => toggle(type)}
            className="rounded"
          />
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entityColors[type] }}
          />
          <span className="text-text-primary">{entityLabels[type]}</span>
        </label>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create ConnectionTypeFilter**

```typescript
// src/features/filters/ConnectionTypeFilter.tsx
import { useFilterStore } from '@/stores/useFilterStore'
import { getConnectionCategory, connectionCategoryColors } from '@/lib/colors'
import type { ConnectionType } from '@/types'

const categories = ['political', 'military', 'social', 'geographic', 'cultural'] as const

const connectionsByCategory: Record<string, ConnectionType[]> = {
  political: ['alliance', 'opposition', 'faction', 'succession', 'assassination', 'appointment'],
  military: ['commanded', 'served_in', 'battle_participation', 'campaign', 'defeated'],
  social: ['family', 'mentorship', 'patronage', 'rivalry', 'marriage'],
  geographic: ['located_in', 'governed', 'trade_route', 'military_route'],
  cultural: ['authored', 'dedicated_to', 'worship', 'built', 'founded'],
}

export function ConnectionTypeFilter() {
  const connectionTypes = useFilterStore((s) => s.connectionTypes)
  const setFilter = useFilterStore((s) => s.setFilter)

  function toggleCategory(category: string) {
    const types = connectionsByCategory[category]
    const allSelected = types.every((t) => connectionTypes.includes(t))
    const next = allSelected
      ? connectionTypes.filter((t) => !types.includes(t))
      : [...new Set([...connectionTypes, ...types])]
    setFilter('connectionTypes', next)
  }

  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold text-text-secondary uppercase">Connection Types</h4>
      {categories.map((cat) => (
        <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer capitalize">
          <input
            type="checkbox"
            checked={
              connectionTypes.length === 0 ||
              connectionsByCategory[cat].every((t) => connectionTypes.includes(t))
            }
            onChange={() => toggleCategory(cat)}
            className="rounded"
          />
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: connectionCategoryColors[cat] }}
          />
          <span className="text-text-primary">{cat}</span>
        </label>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create TimePeriodFilter**

```typescript
// src/features/filters/TimePeriodFilter.tsx
import { useFilterStore } from '@/stores/useFilterStore'
import { formatYear } from '@/lib/geo'

export function TimePeriodFilter() {
  const yearRange = useFilterStore((s) => s.yearRange)
  const setFilter = useFilterStore((s) => s.setFilter)

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-text-secondary uppercase">Time Period</h4>
      <div className="flex items-center gap-2 text-sm text-text-primary">
        <span>{formatYear(yearRange[0])}</span>
        <span>—</span>
        <span>{formatYear(yearRange[1])}</span>
      </div>
      <input
        type="range"
        min={-753}
        max={476}
        value={yearRange[0]}
        onChange={(e) => setFilter('yearRange', [Number(e.target.value), yearRange[1]])}
        className="w-full"
      />
      <input
        type="range"
        min={-753}
        max={476}
        value={yearRange[1]}
        onChange={(e) => setFilter('yearRange', [yearRange[0], Number(e.target.value)])}
        className="w-full"
      />
    </div>
  )
}
```

- [ ] **Step 4: Create FilterPanel**

```typescript
// src/features/filters/FilterPanel.tsx
import { EntityTypeFilter } from './EntityTypeFilter'
import { ConnectionTypeFilter } from './ConnectionTypeFilter'
import { TimePeriodFilter } from './TimePeriodFilter'
import { useFilterStore } from '@/stores/useFilterStore'
import { Button } from '@/ui/button'

export function FilterPanel() {
  const resetFilters = useFilterStore((s) => s.resetFilters)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Filters</h3>
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          Reset
        </Button>
      </div>
      <EntityTypeFilter />
      <ConnectionTypeFilter />
      <TimePeriodFilter />
    </div>
  )
}
```

- [ ] **Step 5: Integrate FilterPanel and PathFinder into InvestigationBoard**

Update `InvestigationBoard.tsx` to add a toggleable left sidebar with FilterPanel and PathFinder:

```tsx
import { FilterPanel } from '@/features/filters/FilterPanel'
import { PathFinder } from '@/features/search/PathFinder'
// ...
const sidebarOpen = useUIStore((s) => s.sidebarOpen)
// In the layout, before <main>:
{
  sidebarOpen && (
    <aside className="w-[280px] border-r border-border bg-bg-secondary overflow-y-auto">
      <FilterPanel />
      <div className="border-t border-border" />
      <PathFinder />
    </aside>
  )
}
```

Add a sidebar toggle button to TopBar.

- [ ] **Step 6: Commit**

```bash
git add src/features/filters/ src/features/board/
git commit -m "feat: add filter panel with entity type, connection type, and time period filters"
```

---

### Task 16: Detail panel feature

**Files:**

- Create: `src/features/detail/DetailPanel.tsx`
- Create: `src/features/detail/EntityHeader.tsx`
- Create: `src/features/detail/EgoRadar.tsx`
- Create: `src/features/detail/ConnectionList.tsx`
- Create: `src/features/detail/SourceLinks.tsx`

- [ ] **Step 1: Create EntityHeader**

```typescript
// src/features/detail/EntityHeader.tsx
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { entityLabels, entityColors } from '@/lib/colors'
import { formatYear } from '@/lib/geo'
import type { Entity } from '@/types'

export function EntityHeader({ entity }: { entity: Entity }) {
  const pinnedIds = useSelectionStore((s) => s.pinnedIds)
  const pin = useSelectionStore((s) => s.pin)
  const unpin = useSelectionStore((s) => s.unpin)
  const isPinned = pinnedIds.includes(entity.id)

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <Badge style={{ backgroundColor: entityColors[entity.entityType], color: '#fff' }}>
            {entityLabels[entity.entityType]}
          </Badge>
          <h2 className="text-lg font-bold mt-1">{entity.name}</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (isPinned ? unpin(entity.id) : pin(entity.id))}
        >
          {isPinned ? 'Unpin' : 'Pin'}
        </Button>
      </div>
      {entity.yearStart != null && (
        <p className="text-sm text-text-secondary">
          {formatYear(entity.yearStart)}
          {entity.yearEnd != null && ` — ${formatYear(entity.yearEnd)}`}
        </p>
      )}
      <p className="text-sm text-text-primary">{entity.description}</p>
    </div>
  )
}
```

- [ ] **Step 2: Create ConnectionList**

```typescript
// src/features/detail/ConnectionList.tsx
import { useMemo } from 'react'
import { connections, entities } from '@/data'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { getConnectionCategory, connectionCategoryColors } from '@/lib/colors'

export function ConnectionList({ entityId }: { entityId: string }) {
  const select = useSelectionStore((s) => s.select)

  const related = useMemo(() => {
    return connections
      .filter((c) => c.source === entityId || c.target === entityId)
      .map((c) => {
        const otherId = c.source === entityId ? c.target : c.source
        const other = entities.find((e) => e.id === otherId)
        return { connection: c, other }
      })
      .filter((r) => r.other != null)
  }, [entityId])

  if (related.length === 0) {
    return <p className="text-sm text-text-secondary">No connections found.</p>
  }

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold">Connections ({related.length})</h3>
      {related.map(({ connection, other }) => (
        <button
          key={connection.id}
          className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-bg-secondary flex items-center gap-2"
          onClick={() => select(other!.id)}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              backgroundColor:
                connectionCategoryColors[getConnectionCategory(connection.connectionType)],
            }}
          />
          <span className="text-text-primary truncate">{other!.name}</span>
          <span className="text-xs text-text-secondary ml-auto shrink-0">
            {connection.connectionType.replace('_', ' ')}
          </span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create SourceLinks**

```typescript
// src/features/detail/SourceLinks.tsx
export function SourceLinks({ sources }: { sources: string[] }) {
  if (sources.length === 0) return null

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold">Sources</h3>
      {sources.map((source, i) => (
        <a
          key={i}
          href={source}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-accent-blue hover:underline truncate"
        >
          {source}
        </a>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create EgoRadar**

```typescript
// src/features/detail/EgoRadar.tsx
import { useMemo } from 'react'
import * as d3 from 'd3'
import { connections, entities } from '@/data'
import { getConnectionCategory, connectionCategoryColors } from '@/lib/colors'

const SIZE = 200
const RADIUS = SIZE / 2 - 20
const categories = ['political', 'military', 'social', 'geographic', 'cultural']

export function EgoRadar({ entityId }: { entityId: string }) {
  const data = useMemo(() => {
    const related = connections.filter(
      (c) => c.source === entityId || c.target === entityId,
    )
    const counts = new Map<string, number>()
    for (const c of related) {
      const cat = getConnectionCategory(c.connectionType)
      counts.set(cat, (counts.get(cat) ?? 0) + 1)
    }
    return categories.map((cat) => ({ category: cat, count: counts.get(cat) ?? 0 }))
  }, [entityId])

  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const angleScale = d3.scaleBand().domain(categories).range([0, 2 * Math.PI])

  return (
    <div className="flex justify-center">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <g transform={`translate(${SIZE / 2}, ${SIZE / 2})`}>
          {/* Grid circles */}
          {[0.25, 0.5, 0.75, 1].map((r) => (
            <circle
              key={r}
              r={RADIUS * r}
              fill="none"
              stroke="#333"
              strokeWidth={0.5}
            />
          ))}
          {/* Spokes and data */}
          {data.map((d) => {
            const angle = (angleScale(d.category) ?? 0) - Math.PI / 2
            const r = (d.count / maxCount) * RADIUS
            const x = Math.cos(angle) * r
            const y = Math.sin(angle) * r
            const labelX = Math.cos(angle) * (RADIUS + 12)
            const labelY = Math.sin(angle) * (RADIUS + 12)
            return (
              <g key={d.category}>
                <line x1={0} y1={0} x2={Math.cos(angle) * RADIUS} y2={Math.sin(angle) * RADIUS} stroke="#333" strokeWidth={0.5} />
                <circle cx={x} cy={y} r={4} fill={connectionCategoryColors[d.category]} />
                <text x={labelX} y={labelY} fontSize={8} fill="#888" textAnchor="middle" dominantBaseline="middle">
                  {d.category}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
```

- [ ] **Step 5: Create DetailPanel with mobile Drawer**

```typescript
// src/features/detail/DetailPanel.tsx
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useUIStore } from '@/stores/useUIStore'
import { entities } from '@/data'
import { EntityHeader } from './EntityHeader'
import { EgoRadar } from './EgoRadar'
import { ConnectionList } from './ConnectionList'
import { SourceLinks } from './SourceLinks'
import { Drawer, DrawerContent } from '@/ui/drawer'
import { ScrollArea } from '@/ui/scroll-area'
import { Button } from '@/ui/button'

export function DetailPanel() {
  const selectedId = useSelectionStore((s) => s.selectedId)
  const select = useSelectionStore((s) => s.select)
  const isMobile = useUIStore((s) => s.isMobile)

  const entity = selectedId ? entities.find((e) => e.id === selectedId) : null

  if (!entity) return null

  const content = (
    <div className="p-4 space-y-4">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => select(null)}>
          ✕
        </Button>
      </div>
      <EntityHeader entity={entity} />
      <EgoRadar entityId={entity.id} />
      <ConnectionList entityId={entity.id} />
      <SourceLinks sources={entity.sources} />
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={!!selectedId} onOpenChange={(open) => !open && select(null)}>
        <DrawerContent className="bg-bg-secondary text-text-primary max-h-[80vh]">
          <ScrollArea className="h-full">{content}</ScrollArea>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <aside className="w-[340px] border-l border-border bg-bg-secondary overflow-hidden">
      <ScrollArea className="h-full">{content}</ScrollArea>
    </aside>
  )
}
```

- [ ] **Step 5: Update InvestigationBoard to use DetailPanel**

Replace the placeholder aside in `InvestigationBoard.tsx` with `<DetailPanel />`.

- [ ] **Step 6: Commit**

```bash
git add src/features/detail/ src/features/board/InvestigationBoard.tsx
git commit -m "feat: add detail panel with entity header, connections, sources, mobile drawer"
```

---

### Task 17: URL sync with Zustand

**Files:**

- Create: `src/app/useURLSync.ts`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Create URL sync hook**

```typescript
// src/app/useURLSync.ts
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useUIStore } from '@/stores/useUIStore'

export function useURLSync() {
  const [searchParams, setSearchParams] = useSearchParams()
  const select = useSelectionStore((s) => s.select)
  const switchLens = useUIStore((s) => s.switchLens)

  // Read URL on mount
  useEffect(() => {
    const entityId = searchParams.get('entity')
    const lens = searchParams.get('lens') as 'graph' | 'map' | 'timeline' | 'stats' | null
    if (entityId) select(entityId)
    if (lens) switchLens(lens)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Write URL on state changes
  useEffect(() => {
    const unsubs = [
      useSelectionStore.subscribe((state) => {
        setSearchParams(
          (prev) => {
            if (state.selectedId) prev.set('entity', state.selectedId)
            else prev.delete('entity')
            return prev
          },
          { replace: true },
        )
      }),
      useUIStore.subscribe((state) => {
        setSearchParams(
          (prev) => {
            prev.set('lens', state.lens)
            return prev
          },
          { replace: true },
        )
      }),
    ]
    return () => unsubs.forEach((u) => u())
  }, [setSearchParams])
}
```

- [ ] **Step 2: Add useURLSync to InvestigationBoard**

Add `useURLSync()` call at the top of the `InvestigationBoard` component.

- [ ] **Step 3: Commit**

```bash
git add src/app/useURLSync.ts src/features/board/InvestigationBoard.tsx
git commit -m "feat: add URL sync for entity selection and lens state"
```

---

### Task 18: Mobile responsiveness

**Files:**

- Create: `src/app/useMobileDetect.ts`
- Modify: `src/features/board/InvestigationBoard.tsx`

- [ ] **Step 1: Create mobile detection hook**

```typescript
// src/app/useMobileDetect.ts
import { useEffect } from 'react'
import { useUIStore } from '@/stores/useUIStore'

export function useMobileDetect() {
  const setMobile = useUIStore((s) => s.setMobile)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)')
    setMobile(query.matches)

    function handler(e: MediaQueryListEvent) {
      setMobile(e.matches)
    }
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }, [setMobile])
}
```

- [ ] **Step 2: Add to InvestigationBoard**

Add `useMobileDetect()` call at the top of `InvestigationBoard`.

- [ ] **Step 3: Verify responsive behavior**

```bash
npm run dev
```

Open browser, toggle mobile viewport. Detail panel should render as Drawer on mobile, sidebar on desktop.

- [ ] **Step 4: Commit**

```bash
git add src/app/useMobileDetect.ts src/features/board/InvestigationBoard.tsx
git commit -m "feat: add mobile detection with responsive detail panel"
```

---

## Chunk 3: Visualization Features

### Task 19: GraphView — D3 force-directed network

**Files:**

- Create: `src/features/graph/GraphView.tsx`
- Create: `src/features/graph/graph.utils.ts`

- [ ] **Step 1: Create graph utilities**

```typescript
// src/features/graph/graph.utils.ts
import type { Entity, Connection, GraphNode, GraphLink } from '@/types'
import { entityColors } from '@/lib/colors'

export function entitiesToNodes(entities: Entity[]): GraphNode[] {
  return entities.map((e) => ({
    id: e.id,
    name: e.name,
    entityType: e.entityType,
    radius: 6,
  }))
}

export function connectionsToLinks(connections: Connection[], nodeIds: Set<string>): GraphLink[] {
  return connections
    .filter((c) => nodeIds.has(c.source) && nodeIds.has(c.target))
    .map((c) => ({
      id: c.id,
      source: c.source,
      target: c.target,
      connectionType: c.connectionType,
      strength: c.strength,
    }))
}

export function getNodeColor(entityType: string): string {
  return entityColors[entityType as keyof typeof entityColors] ?? '#888'
}
```

- [ ] **Step 2: Create GraphView component**

```typescript
// src/features/graph/GraphView.tsx
import { useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import { entities, connections } from '@/data'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useFilterStore } from '@/stores/useFilterStore'
import { filterEntities, filterConnections } from '@/lib/filtering'
import { entitiesToNodes, connectionsToLinks, getNodeColor } from './graph.utils'
import type { GraphNode, GraphLink } from '@/types'

export function GraphView() {
  const svgRef = useRef<SVGSVGElement>(null)
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)
  const select = useSelectionStore((s) => s.select)
  const selectedId = useSelectionStore((s) => s.selectedId)

  const filters = useFilterStore((s) => ({
    entityTypes: s.entityTypes,
    connectionTypes: s.connectionTypes,
    regions: s.regions,
    yearRange: s.yearRange,
    searchQuery: s.searchQuery,
  }))

  const filteredEntities = useMemo(
    () => filterEntities(entities, filters),
    [filters],
  )

  const filteredConnections = useMemo(() => {
    const ids = new Set(filteredEntities.map((e) => e.id))
    return filterConnections(connections, ids, filters)
  }, [filteredEntities, filters])

  const nodes = useMemo(() => entitiesToNodes(filteredEntities), [filteredEntities])
  const links = useMemo(
    () => connectionsToLinks(filteredConnections, new Set(nodes.map((n) => n.id))),
    [filteredConnections, nodes],
  )

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    const width = svgRef.current?.clientWidth ?? 800
    const height = svgRef.current?.clientHeight ?? 600

    svg.selectAll('*').remove()

    const g = svg.append('g')

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => g.attr('transform', event.transform))
    svg.call(zoom)

    // Links
    const linkSel = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#555')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', (d) => d.strength)

    // Nodes
    const nodeSel = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => getNodeColor(d.entityType))
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('click', (_, d) => select(d.id))
      .call(
        d3.drag<SVGCircleElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulationRef.current?.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulationRef.current?.alphaTarget(0)
            d.fx = null
            d.fy = null
          }),
      )

    // Labels
    const labelSel = g.append('g')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text((d) => d.name)
      .attr('font-size', 9)
      .attr('fill', '#ccc')
      .attr('dx', 8)
      .attr('dy', 3)

    // Simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(60))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(12))
      .on('tick', () => {
        linkSel
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y)
        nodeSel.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!)
        labelSel.attr('x', (d) => d.x!).attr('y', (d) => d.y!)
      })

    simulationRef.current = simulation

    return () => {
      simulation.stop()
    }
  }, [nodes, links, select])

  // Highlight selected node
  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('circle')
      .attr('stroke', (d: any) => (d.id === selectedId ? '#fff' : '#fff'))
      .attr('stroke-width', (d: any) => (d.id === selectedId ? 2.5 : 0.5))
      .attr('r', (d: any) => (d.id === selectedId ? 10 : d.radius))
  }, [selectedId])

  return (
    <svg
      ref={svgRef}
      className="w-full h-full bg-bg-primary"
    />
  )
}
```

- [ ] **Step 3: Create GraphControls stub**

```typescript
// src/features/graph/GraphControls.tsx
import { Button } from '@/ui/button'

interface Props {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}

export function GraphControls({ onZoomIn, onZoomOut, onReset }: Props) {
  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-1 bg-bg-card border border-border rounded-md p-1">
      <Button variant="ghost" size="sm" onClick={onZoomIn}>+</Button>
      <Button variant="ghost" size="sm" onClick={onZoomOut}>−</Button>
      <Button variant="ghost" size="sm" onClick={onReset}>⟲</Button>
    </div>
  )
}
```

- [ ] **Step 4: Wire GraphView into InvestigationBoard**

Replace the graph placeholder in `InvestigationBoard.tsx`:

```tsx
import { GraphView } from '@/features/graph/GraphView'
// ...
{
  lens === 'graph' && <GraphView />
}
```

- [ ] **Step 4: Verify graph renders**

```bash
npm run dev
```

Expected: Force-directed graph with colored nodes (once seed data exists). Nodes draggable, zoomable, clickable.

- [ ] **Step 5: Commit**

```bash
git add src/features/graph/ src/features/board/InvestigationBoard.tsx
git commit -m "feat: add D3 force-directed GraphView with zoom, drag, and selection"
```

---

### Task 20: MapView — Leaflet with entity markers

**Files:**

- Create: `src/features/map/MapView.tsx`
- Create: `src/features/map/EntityMarkers.tsx`
- Create: `src/features/map/TerritoryLayer.tsx`
- Create: `src/features/map/MapControls.tsx`

- [ ] **Step 1: Create EntityMarkers**

```typescript
// src/features/map/EntityMarkers.tsx
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { entityColors } from '@/lib/colors'
import type { Entity, Location } from '@/types'

function createIcon(entityType: string) {
  const color = entityColors[entityType as keyof typeof entityColors] ?? '#888'
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  })
}

export function EntityMarkers({ entities }: { entities: Entity[] }) {
  const select = useSelectionStore((s) => s.select)

  const locatable = entities.filter(
    (e): e is Location => e.entityType === 'location' && 'coordinates' in e && !!e.coordinates,
  )

  return (
    <>
      {locatable.map((entity) => (
        <Marker
          key={entity.id}
          position={[entity.coordinates!.lat, entity.coordinates!.lng]}
          icon={createIcon(entity.entityType)}
          eventHandlers={{ click: () => select(entity.id) }}
        >
          <Popup>
            <strong>{entity.name}</strong>
            <p className="text-xs">{entity.description.slice(0, 100)}</p>
          </Popup>
        </Marker>
      ))}
    </>
  )
}
```

- [ ] **Step 2: Create TerritoryLayer stub**

```typescript
// src/features/map/TerritoryLayer.tsx
import { GeoJSON } from 'react-leaflet'
import { useTimelineStore } from '@/stores/useTimelineStore'
import type { TerritorySnapshot } from '@/types'

const statusColors: Record<string, string> = {
  core: '#8b0000',
  province: '#cd5c5c',
  client: '#e89040',
  contested: '#daa520',
  lost: '#555',
}

export function TerritoryLayer({ snapshots }: { snapshots: TerritorySnapshot[] }) {
  const currentYear = useTimelineStore((s) => s.currentYear)

  // Find nearest snapshot to current year
  const nearest = snapshots
    .filter((s) => s.year <= currentYear)
    .sort((a, b) => b.year - a.year)

  if (nearest.length === 0) return null

  // Group by the most recent year
  const activeYear = nearest[0].year
  const active = nearest.filter((s) => s.year === activeYear)

  return (
    <>
      {active.map((territory) => (
        <GeoJSON
          key={`${territory.id}-${territory.year}`}
          data={territory.boundaries}
          style={{
            fillColor: statusColors[territory.status] ?? '#555',
            fillOpacity: 0.25,
            color: statusColors[territory.status] ?? '#555',
            weight: 1.5,
          }}
        />
      ))}
    </>
  )
}
```

- [ ] **Step 3: Create MapControls**

```typescript
// src/features/map/MapControls.tsx
import { useState } from 'react'
import { Button } from '@/ui/button'

interface MapControlsProps {
  showTerritories: boolean
  onToggleTerritories: () => void
}

export function MapControls({ showTerritories, onToggleTerritories }: MapControlsProps) {
  return (
    <div className="absolute top-4 right-4 z-[1000] bg-bg-card border border-border rounded-md p-2 space-y-1">
      <Button
        variant={showTerritories ? 'default' : 'ghost'}
        size="sm"
        onClick={onToggleTerritories}
      >
        Territories
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Create MapView**

```typescript
// src/features/map/MapView.tsx
import { useState, useMemo } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { entities, territories } from '@/data'
import { useFilterStore } from '@/stores/useFilterStore'
import { filterEntities } from '@/lib/filtering'
import { EntityMarkers } from './EntityMarkers'
import { TerritoryLayer } from './TerritoryLayer'
import { MapControls } from './MapControls'

export function MapView() {
  const [showTerritories, setShowTerritories] = useState(true)
  const filters = useFilterStore()

  const filteredEntities = useMemo(
    () => filterEntities(entities, filters),
    [filters],
  )

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[41.9, 12.5]}
        zoom={5}
        className="w-full h-full"
        style={{ background: '#0f0a1a' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        <EntityMarkers entities={filteredEntities} />
        {showTerritories && <TerritoryLayer snapshots={territories} />}
      </MapContainer>
      <MapControls
        showTerritories={showTerritories}
        onToggleTerritories={() => setShowTerritories(!showTerritories)}
      />
    </div>
  )
}
```

- [ ] **Step 5: Create RouteOverlay stub**

```typescript
// src/features/map/RouteOverlay.tsx
import { Polyline } from 'react-leaflet'

interface Route {
  id: string
  name: string
  coordinates: [number, number][]
  type: 'military' | 'trade' | 'road'
}

const routeColors = {
  military: '#c0392b',
  trade: '#f39c12',
  road: '#7f8c8d',
}

export function RouteOverlay({ routes }: { routes: Route[] }) {
  return (
    <>
      {routes.map((route) => (
        <Polyline
          key={route.id}
          positions={route.coordinates}
          pathOptions={{
            color: routeColors[route.type],
            weight: 2,
            dashArray: route.type === 'trade' ? '5, 5' : undefined,
            opacity: 0.7,
          }}
        />
      ))}
    </>
  )
}
```

- [ ] **Step 6: Wire MapView into InvestigationBoard**

```tsx
import { MapView } from '@/features/map/MapView'
// ...
{
  lens === 'map' && <MapView />
}
```

- [ ] **Step 7: Commit**

```bash
git add src/features/map/ src/features/board/InvestigationBoard.tsx
git commit -m "feat: add Leaflet MapView with entity markers, territory layer, route overlay, and controls"
```

---

### Task 21: TimelineView — D3 multi-lane timeline

**Files:**

- Create: `src/features/timeline/TimelineView.tsx`
- Create: `src/features/timeline/TimelineLane.tsx`
- Create: `src/features/timeline/TimelinePlayer.tsx`
- Create: `src/features/timeline/era.utils.ts`
- Create: `src/features/timeline/EraOverlay.tsx`
- Create: `src/features/timeline/TimelineTooltip.tsx`
- Test: `src/features/timeline/era.utils.test.ts`

- [ ] **Step 1: Write era detection tests**

```typescript
// src/features/timeline/era.utils.test.ts
import { describe, it, expect } from 'vitest'
import { detectEras } from './era.utils'

describe('detectEras', () => {
  it('returns empty for no events', () => {
    expect(detectEras([])).toEqual([])
  })

  it('detects era from clustered years', () => {
    const years = [-264, -260, -255, -250, -241, -218, -216, -210, -202]
    const eras = detectEras(years)
    expect(eras.length).toBeGreaterThan(0)
    expect(eras[0]).toHaveProperty('startYear')
    expect(eras[0]).toHaveProperty('endYear')
    expect(eras[0]).toHaveProperty('density')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/features/timeline/era.utils.test.ts
```

- [ ] **Step 3: Implement era detection**

```typescript
// src/features/timeline/era.utils.ts
export interface Era {
  startYear: number
  endYear: number
  density: number
}

const BIN_SIZE = 25

export function detectEras(years: number[], threshold = 0.5): Era[] {
  if (years.length === 0) return []

  const sorted = [...years].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]

  // Bin years into 25-year buckets
  const bins = new Map<number, number>()
  for (const y of sorted) {
    const bin = Math.floor(y / BIN_SIZE) * BIN_SIZE
    bins.set(bin, (bins.get(bin) ?? 0) + 1)
  }

  // Find max density for normalization
  const maxCount = Math.max(...bins.values())
  if (maxCount === 0) return []

  // Identify high-density regions
  const eras: Era[] = []
  let currentEra: Era | null = null

  for (let bin = Math.floor(min / BIN_SIZE) * BIN_SIZE; bin <= max; bin += BIN_SIZE) {
    const count = bins.get(bin) ?? 0
    const density = count / maxCount

    if (density >= threshold) {
      if (!currentEra) {
        currentEra = { startYear: bin, endYear: bin + BIN_SIZE, density }
      } else {
        currentEra.endYear = bin + BIN_SIZE
        currentEra.density = Math.max(currentEra.density, density)
      }
    } else if (currentEra) {
      eras.push(currentEra)
      currentEra = null
    }
  }
  if (currentEra) eras.push(currentEra)

  return eras
}
```

- [ ] **Step 4: Run test**

```bash
npm test -- src/features/timeline/era.utils.test.ts
```

Expected: PASS.

- [ ] **Step 5: Create TimelineTooltip**

```typescript
// src/features/timeline/TimelineTooltip.tsx
import { formatYear } from '@/lib/geo'
import type { Entity } from '@/types'

interface Props {
  entity: Entity
  x: number
  y: number
}

export function TimelineTooltip({ entity, x, y }: Props) {
  return (
    <div
      className="absolute z-50 bg-bg-card border border-border rounded px-2 py-1 text-xs pointer-events-none shadow-lg"
      style={{ left: x + 10, top: y - 10 }}
    >
      <strong>{entity.name}</strong>
      {entity.yearStart != null && (
        <div className="text-text-secondary">
          {formatYear(entity.yearStart)}
          {entity.yearEnd != null && ` — ${formatYear(entity.yearEnd)}`}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Create EraOverlay**

```typescript
// src/features/timeline/EraOverlay.tsx
import type { Era } from './era.utils'

interface Props {
  eras: Era[]
  xScale: (year: number) => number
  height: number
}

export function EraOverlay({ eras, xScale, height }: Props) {
  return (
    <g className="era-overlay">
      {eras.map((era, i) => (
        <rect
          key={i}
          x={xScale(era.startYear)}
          y={0}
          width={xScale(era.endYear) - xScale(era.startYear)}
          height={height}
          fill="#d4af37"
          fillOpacity={0.06 * era.density}
          stroke="none"
        />
      ))}
    </g>
  )
}
```

- [ ] **Step 7: Create TimelinePlayer**

```typescript
// src/features/timeline/TimelinePlayer.tsx
import { useEffect, useRef } from 'react'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { formatYear } from '@/lib/geo'
import { Button } from '@/ui/button'

const YEARS_PER_SECOND = 50

export function TimelinePlayer() {
  const { playing, currentYear, speed, play, pause, setYear, setSpeed } = useTimelineStore()
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!playing) return

    function tick(timestamp: number) {
      if (lastTimeRef.current) {
        const delta = (timestamp - lastTimeRef.current) / 1000
        const yearDelta = delta * YEARS_PER_SECOND * speed
        const newYear = useTimelineStore.getState().currentYear + yearDelta
        if (newYear >= 476) {
          pause()
          setYear(476)
          return
        }
        setYear(newYear)
      }
      lastTimeRef.current = timestamp
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafRef.current)
      lastTimeRef.current = 0
    }
  }, [playing, speed, pause, setYear])

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-bg-secondary border-t border-border">
      <Button size="sm" variant="ghost" onClick={() => (playing ? pause() : play())}>
        {playing ? '⏸' : '▶'}
      </Button>
      <span className="text-sm font-mono text-text-primary w-20">
        {formatYear(Math.round(currentYear))}
      </span>
      <input
        type="range"
        min={-753}
        max={476}
        value={currentYear}
        onChange={(e) => setYear(Number(e.target.value))}
        className="flex-1"
      />
      <select
        value={speed}
        onChange={(e) => setSpeed(Number(e.target.value))}
        className="bg-bg-primary border border-border text-text-primary text-xs rounded px-1 py-0.5"
      >
        <option value={0.5}>0.5x</option>
        <option value={1}>1x</option>
        <option value={2}>2x</option>
        <option value={4}>4x</option>
      </select>
    </div>
  )
}
```

- [ ] **Step 8: Create TimelineLane**

```typescript
// src/features/timeline/TimelineLane.tsx
import { useMemo } from 'react'
import { entityColors } from '@/lib/colors'
import type { Entity, EntityType } from '@/types'

interface Props {
  entities: Entity[]
  entityType: EntityType
  xScale: (year: number) => number
  y: number
  height: number
  onHover: (entity: Entity | null, x: number, y: number) => void
  onSelect: (id: string) => void
}

export function TimelineLane({ entities, entityType, xScale, y, height, onHover, onSelect }: Props) {
  const laneEntities = useMemo(
    () => entities.filter((e) => e.entityType === entityType && e.yearStart != null),
    [entities, entityType],
  )

  const color = entityColors[entityType]

  return (
    <g transform={`translate(0, ${y})`}>
      {/* Lane background */}
      <rect x={0} y={0} width="100%" height={height} fill="#fff" fillOpacity={0.02} />

      {/* Lane label */}
      <text x={4} y={14} fontSize={10} fill="#888" className="capitalize">
        {entityType}
      </text>

      {/* Entity bars */}
      {laneEntities.map((entity) => {
        const x1 = xScale(entity.yearStart!)
        const x2 = entity.yearEnd != null ? xScale(entity.yearEnd) : x1 + 4
        const barWidth = Math.max(x2 - x1, 3)

        return (
          <rect
            key={entity.id}
            x={x1}
            y={20}
            width={barWidth}
            height={height - 24}
            rx={2}
            fill={color}
            fillOpacity={0.7}
            stroke={color}
            strokeWidth={0.5}
            className="cursor-pointer hover:fill-opacity-100"
            onMouseEnter={(e) => onHover(entity, e.clientX, e.clientY)}
            onMouseLeave={() => onHover(null, 0, 0)}
            onClick={() => onSelect(entity.id)}
          />
        )
      })}
    </g>
  )
}
```

- [ ] **Step 9: Create TimelineView orchestrator**

```typescript
// src/features/timeline/TimelineView.tsx
import { useMemo, useState, useRef } from 'react'
import * as d3 from 'd3'
import { entities } from '@/data'
import { useFilterStore } from '@/stores/useFilterStore'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { filterEntities } from '@/lib/filtering'
import { detectEras } from './era.utils'
import { TimelineLane } from './TimelineLane'
import { TimelinePlayer } from './TimelinePlayer'
import { TimelineTooltip } from './TimelineTooltip'
import { EraOverlay } from './EraOverlay'
import type { Entity, EntityType } from '@/types'

const lanes: EntityType[] = ['person', 'event', 'organization', 'legion', 'location']
const LANE_HEIGHT = 80

export function TimelineView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const filters = useFilterStore()
  const select = useSelectionStore((s) => s.select)
  const [tooltip, setTooltip] = useState<{ entity: Entity; x: number; y: number } | null>(null)

  const filteredEntities = useMemo(
    () => filterEntities(entities, filters),
    [filters],
  )

  const width = containerRef.current?.clientWidth ?? 1200
  const height = lanes.length * LANE_HEIGHT

  const xScale = useMemo(
    () => d3.scaleLinear().domain([-753, 476]).range([80, width - 20]),
    [width],
  )

  const years = useMemo(
    () => filteredEntities.filter((e) => e.yearStart != null).map((e) => e.yearStart!),
    [filteredEntities],
  )
  const eras = useMemo(() => detectEras(years), [years])

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-auto relative">
        <svg width={width} height={height} className="bg-bg-primary">
          <EraOverlay eras={eras} xScale={xScale} height={height} />
          {lanes.map((type, i) => (
            <TimelineLane
              key={type}
              entities={filteredEntities}
              entityType={type}
              xScale={xScale}
              y={i * LANE_HEIGHT}
              height={LANE_HEIGHT}
              onHover={(entity, x, y) =>
                entity ? setTooltip({ entity, x, y }) : setTooltip(null)
              }
              onSelect={select}
            />
          ))}
        </svg>
        {tooltip && (
          <TimelineTooltip entity={tooltip.entity} x={tooltip.x} y={tooltip.y} />
        )}
      </div>
      <TimelinePlayer />
    </div>
  )
}
```

- [ ] **Step 10: Wire TimelineView into InvestigationBoard**

```tsx
import { TimelineView } from '@/features/timeline/TimelineView'
// ...
{
  lens === 'timeline' && <TimelineView />
}
```

- [ ] **Step 11: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 12: Commit**

```bash
git add src/features/timeline/ src/features/board/InvestigationBoard.tsx
git commit -m "feat: add TimelineView with multi-lane display, era detection, and playback"
```

---

## Chunk 4: Stats, Stories, Seed Data & Deployment

### Task 22: StatsView — decomposed dashboard

**Files:**

- Create: `src/features/stats/StatsView.tsx`
- Create: `src/features/stats/SummaryCards.tsx`
- Create: `src/features/stats/TopConnected.tsx`
- Create: `src/features/stats/ConnectionDist.tsx`

- [ ] **Step 1: Create SummaryCards**

```typescript
// src/features/stats/SummaryCards.tsx
import { useMemo } from 'react'
import { entities, connections } from '@/data'
import { entityLabels } from '@/lib/colors'
import type { EntityType } from '@/types'

export function SummaryCards() {
  const counts = useMemo(() => {
    const byType = new Map<EntityType, number>()
    for (const e of entities) {
      byType.set(e.entityType, (byType.get(e.entityType) ?? 0) + 1)
    }
    return byType
  }, [])

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card label="Total Entities" value={entities.length} />
      <Card label="Connections" value={connections.length} />
      {[...counts.entries()].slice(0, 6).map(([type, count]) => (
        <Card key={type} label={entityLabels[type]} value={count} />
      ))}
    </div>
  )
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-bg-card border border-border rounded-lg p-3">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
    </div>
  )
}
```

- [ ] **Step 2: Create TopConnected**

```typescript
// src/features/stats/TopConnected.tsx
import { useMemo } from 'react'
import { entities, connections } from '@/data'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { entityColors } from '@/lib/colors'

export function TopConnected() {
  const select = useSelectionStore((s) => s.select)

  const ranked = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of connections) {
      counts.set(c.source, (counts.get(c.source) ?? 0) + 1)
      counts.set(c.target, (counts.get(c.target) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({
        entity: entities.find((e) => e.id === id),
        count,
      }))
      .filter((r) => r.entity != null)
  }, [])

  const maxCount = ranked[0]?.count ?? 1

  return (
    <div className="bg-bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">Most Connected</h3>
      <div className="space-y-2">
        {ranked.map(({ entity, count }) => (
          <button
            key={entity!.id}
            className="w-full flex items-center gap-2 text-sm hover:bg-bg-secondary rounded px-1 py-0.5"
            onClick={() => select(entity!.id)}
          >
            <span className="w-24 truncate text-left text-text-primary">{entity!.name}</span>
            <div className="flex-1 h-4 bg-bg-primary rounded overflow-hidden">
              <div
                className="h-full rounded"
                style={{
                  width: `${(count / maxCount) * 100}%`,
                  backgroundColor: entityColors[entity!.entityType],
                }}
              />
            </div>
            <span className="text-xs text-text-secondary w-6 text-right">{count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create ConnectionDist**

```typescript
// src/features/stats/ConnectionDist.tsx
import { useMemo } from 'react'
import { connections } from '@/data'
import { getConnectionCategory, connectionCategoryColors } from '@/lib/colors'

export function ConnectionDist() {
  const distribution = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of connections) {
      const cat = getConnectionCategory(c.connectionType)
      counts.set(cat, (counts.get(cat) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [])

  const total = connections.length || 1

  return (
    <div className="bg-bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">Connection Categories</h3>
      <div className="space-y-2">
        {distribution.map(([cat, count]) => (
          <div key={cat} className="flex items-center gap-2 text-sm">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: connectionCategoryColors[cat] }}
            />
            <span className="w-20 capitalize text-text-primary">{cat}</span>
            <div className="flex-1 h-3 bg-bg-primary rounded overflow-hidden">
              <div
                className="h-full rounded"
                style={{
                  width: `${(count / total) * 100}%`,
                  backgroundColor: connectionCategoryColors[cat],
                }}
              />
            </div>
            <span className="text-xs text-text-secondary w-6 text-right">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create StatsView orchestrator**

```typescript
// src/features/stats/StatsView.tsx
import { SummaryCards } from './SummaryCards'
import { TopConnected } from './TopConnected'
import { ConnectionDist } from './ConnectionDist'

export function StatsView() {
  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <h2 className="text-lg font-bold">Network Analytics</h2>
      <SummaryCards />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TopConnected />
        <ConnectionDist />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create remaining chart stubs**

Create `src/features/stats/CenturyChart.tsx`, `RegionChart.tsx`, `ChordDiagram.tsx`, `PowerRankings.tsx` as placeholder components that render a card with the chart title and "Coming soon" text. Each should be ~20-30 lines. Import and render them in `StatsView.tsx` within the grid layout.

Example pattern for each:

```typescript
// src/features/stats/CenturyChart.tsx
export function CenturyChart() {
  return (
    <div className="bg-bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">Connections by Century</h3>
      <p className="text-sm text-text-secondary">Chart coming soon</p>
    </div>
  )
}
```

- [ ] **Step 6: Wire StatsView into InvestigationBoard**

```tsx
import { StatsView } from '@/features/stats/StatsView'
// ...
{
  lens === 'stats' && <StatsView />
}
```

- [ ] **Step 6: Commit**

```bash
git add src/features/stats/ src/features/board/InvestigationBoard.tsx
git commit -m "feat: add StatsView with summary cards, top connected, and connection distribution"
```

---

### Task 23: Stories / Guided Mode

**Files:**

- Create: `src/features/stories/StoryPlayer.tsx`
- Create: `src/features/stories/NarrationBar.tsx`
- Create: `src/features/stories/useStoryMode.ts`

- [ ] **Step 1: Create story mode hook**

```typescript
// src/features/stories/useStoryMode.ts
import { useState, useCallback } from 'react'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useFilterStore } from '@/stores/useFilterStore'
import type { Story } from '@/types'

export function useStoryMode() {
  const [activeStory, setActiveStory] = useState<Story | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const select = useSelectionStore((s) => s.select)
  const { saveSnapshot, restoreSnapshot } = useFilterStore()

  const enter = useCallback(
    (story: Story) => {
      saveSnapshot()
      setActiveStory(story)
      setStepIndex(0)
      if (story.steps[0]) select(story.steps[0].entityId)
    },
    [saveSnapshot, select],
  )

  const exit = useCallback(() => {
    restoreSnapshot()
    setActiveStory(null)
    setStepIndex(0)
  }, [restoreSnapshot])

  const nextStep = useCallback(() => {
    if (!activeStory) return
    const next = stepIndex + 1
    if (next >= activeStory.steps.length) return
    setStepIndex(next)
    select(activeStory.steps[next].entityId)
  }, [activeStory, stepIndex, select])

  const prevStep = useCallback(() => {
    if (!activeStory || stepIndex <= 0) return
    const prev = stepIndex - 1
    setStepIndex(prev)
    select(activeStory.steps[prev].entityId)
  }, [activeStory, stepIndex, select])

  return {
    activeStory,
    stepIndex,
    currentStep: activeStory?.steps[stepIndex] ?? null,
    isActive: activeStory !== null,
    isLastStep: activeStory ? stepIndex >= activeStory.steps.length - 1 : false,
    enter,
    exit,
    nextStep,
    prevStep,
  }
}
```

- [ ] **Step 2: Create NarrationBar**

```typescript
// src/features/stories/NarrationBar.tsx
import { Button } from '@/ui/button'
import type { Story, StoryStep } from '@/types'

interface Props {
  story: Story
  step: StoryStep
  stepIndex: number
  totalSteps: number
  isLastStep: boolean
  onNext: () => void
  onPrev: () => void
  onExit: () => void
}

export function NarrationBar({ story, step, stepIndex, totalSteps, isLastStep, onNext, onPrev, onExit }: Props) {
  return (
    <div className="border-t border-accent-gold/30 bg-bg-secondary p-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <p className="text-xs text-accent-gold font-semibold mb-1">
            {story.title} — Step {stepIndex + 1} of {totalSteps}
          </p>
          <p className="text-sm text-text-primary">{step.text}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="ghost" onClick={onPrev} disabled={stepIndex === 0}>
            ← Prev
          </Button>
          {isLastStep ? (
            <Button size="sm" variant="default" onClick={onExit}>
              Finish
            </Button>
          ) : (
            <Button size="sm" variant="default" onClick={onNext}>
              Next →
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onExit}>
            Exit
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create StoryPlayer (story selection UI)**

```typescript
// src/features/stories/StoryPlayer.tsx
import { stories } from '@/data'
import { Button } from '@/ui/button'
import type { Story } from '@/types'

interface Props {
  onSelect: (story: Story) => void
}

export function StoryPlayer({ onSelect }: Props) {
  if (stories.length === 0) {
    return <p className="text-sm text-text-secondary p-4">No stories available yet.</p>
  }

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-semibold">Guided Stories</h3>
      {stories.map((story) => (
        <div key={story.id} className="bg-bg-card border border-border rounded-lg p-3">
          <h4 className="font-medium text-sm">{story.title}</h4>
          <p className="text-xs text-text-secondary mt-1">{story.description}</p>
          <Button size="sm" className="mt-2" onClick={() => onSelect(story)}>
            Start Story
          </Button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Integrate stories into InvestigationBoard**

Add `useStoryMode()` to InvestigationBoard. Render `<NarrationBar>` when a story is active. Pass `storyMode.enter` to the TopBar for a "Stories" button that opens a dropdown/dialog with `<StoryPlayer>`.

- [ ] **Step 5: Commit**

```bash
git add src/features/stories/ src/features/board/
git commit -m "feat: add guided story mode with narration bar and step navigation"
```

---

### Task 24: Landing page

**Files:**

- Create: `src/features/landing/LandingPage.tsx`

- [ ] **Step 1: Create LandingPage**

```typescript
// src/features/landing/LandingPage.tsx
import { useNavigate } from 'react-router-dom'
import { entities, stories } from '@/data'
import { Button } from '@/ui/button'
import { entityColors, entityLabels } from '@/lib/colors'

export function LandingPage() {
  const navigate = useNavigate()

  const featured = entities.slice(0, 6)

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-accent-gold mb-4">
          The Hidden Network
        </h1>
        <p className="text-lg text-text-secondary max-w-2xl mb-8">
          Explore the hidden connections of Ancient Rome — from senators and emperors
          to legions and trade routes. Uncover how power, influence, and ideas
          flowed through one of history's greatest civilizations.
        </p>
        <Button size="lg" onClick={() => navigate('/investigate')}>
          Begin Investigation
        </Button>
      </section>

      {/* Featured Entities */}
      {featured.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 py-12">
          <h2 className="text-xl font-semibold mb-6">Featured Entities</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {featured.map((entity) => (
              <button
                key={entity.id}
                className="bg-bg-card border border-border rounded-lg p-4 text-left hover:border-accent-gold/50 transition-colors"
                onClick={() => navigate(`/investigate?entity=${entity.id}`)}
              >
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{ backgroundColor: entityColors[entity.entityType], color: '#fff' }}
                >
                  {entityLabels[entity.entityType]}
                </span>
                <h3 className="font-medium mt-2">{entity.name}</h3>
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                  {entity.description}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Stories */}
      {stories.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 py-12">
          <h2 className="text-xl font-semibold mb-6">Guided Stories</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stories.map((story) => (
              <button
                key={story.id}
                className="bg-bg-card border border-border rounded-lg p-4 text-left hover:border-accent-gold/50 transition-colors"
                onClick={() => navigate(`/investigate?story=${story.id}`)}
              >
                <h3 className="font-medium text-accent-gold">{story.title}</h3>
                <p className="text-sm text-text-secondary mt-1">{story.description}</p>
                <p className="text-xs text-text-secondary mt-2">{story.steps.length} steps</p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add route for landing page**

Update `src/app/App.tsx`:

```tsx
import { LandingPage } from '@/features/landing/LandingPage'
// ...
<Route path="/" element={<LandingPage />} />
<Route path="/investigate" element={<InvestigationBoard />} />
```

- [ ] **Step 3: Commit**

```bash
git add src/features/landing/ src/app/App.tsx
git commit -m "feat: add landing page with hero, featured entities, and guided stories"
```

---

### Task 25: Seed data — Roman history entities and connections

**Files:**

- Modify: `src/data/entities/people.json`
- Modify: `src/data/entities/events.json`
- Modify: `src/data/entities/locations.json`
- Modify: `src/data/entities/organizations.json`
- Modify: `src/data/entities/documents.json`
- Modify: `src/data/entities/legions.json`
- Modify: `src/data/entities/dynasties.json`
- Modify: `src/data/entities/religions.json`
- Modify: `src/data/entities/trade-goods.json`
- Modify: `src/data/entities/infrastructure.json`
- Modify: `src/data/entities/connections.json`
- Modify: `src/data/stories/stories.json`
- Modify: `src/data/territories/territories.json`

- [ ] **Step 1: Populate people.json with ~30 key Roman figures**

Include: Romulus, Numa Pompilius, Lucius Junius Brutus, Scipio Africanus, Gaius Marius, Sulla, Pompey, Julius Caesar, Cicero, Mark Antony, Cleopatra, Augustus, Tiberius, Caligula, Nero, Vespasian, Titus, Trajan, Hadrian, Marcus Aurelius, Commodus, Septimius Severus, Diocletian, Constantine, Theodosius, Romulus Augustulus, Spartacus, Hannibal, Cato the Elder, Brutus (assassin).

Each entry follows `PersonSchema`: id, name, entityType "person", description (2-3 sentences with sourced historical facts), born, died (negative numbers for BC), roles[], faction?, region, sources[].

- [ ] **Step 2: Populate events.json with ~15 key events**

Include: Founding of Rome (-753), Establishment of Republic (-509), Sack of Rome by Gauls (-390), First Punic War (-264), Second Punic War (-218), Third Punic War (-149), Gracchi Reforms (-133), Marian Reforms (-107), Crossing the Rubicon (-49), Assassination of Caesar (-44), Battle of Actium (-31), Great Fire of Rome (64), Eruption of Vesuvius (79), Edict of Milan (313), Fall of Western Rome (476).

- [ ] **Step 3: Populate locations.json with ~15 key locations**

Include: Rome (41.9028, 12.4964), Carthage (36.8565, 10.3375), Alexandria (31.2001, 29.9187), Athens (37.9838, 23.7275), Constantinople (41.0082, 28.9784), Pompeii (40.7462, 14.4989), Jerusalem (31.7683, 35.2137), Londinium (51.5074, -0.1278), Massilia (43.2965, 5.3698), Syracuse (37.0755, 15.2866), Antioch (36.2, 36.15), Ravenna (44.4184, 12.2035), Mediolanum (45.4642, 9.19), Brundisium (40.6327, 17.9467), Hispalis (37.3891, -5.9845).

- [ ] **Step 4: Populate organizations.json with ~5 organizations**

Include: Roman Senate, Praetorian Guard, Legio X Equestris, College of Pontiffs, Optimates faction.

- [ ] **Step 5: Populate documents.json with ~5 documents**

Include: Twelve Tables, Commentarii de Bello Gallico, Res Gestae Divi Augusti, Edict of Milan, Corpus Juris Civilis.

- [ ] **Step 6: Populate remaining entity types**

Create 3-5 entries each for the remaining 5 types:

**legions.json**: Legio X Equestris, Legio XIII Gemina, Legio III Cyrenaica — with founded, disbanded, symbol, homeBase.

**dynasties.json**: Julio-Claudian (-27 to 68), Flavian (69-96), Nerva-Antonine (96-192), Severan (193-235) — with founder, startYear, endYear.

**religions.json**: Roman Polytheism, Cult of Mithras, Early Christianity — with origin, deities[].

**trade-goods.json**: Grain (Egypt→Rome), Olive Oil (Hispania→Rome), Silk (East→Rome) — with origins[], destinations[].

**infrastructure.json**: Via Appia, Aqua Claudia, Colosseum, Hadrian's Wall — with builtBy, builtYear, infraType.

Each entry must follow its Zod schema and have proper id, name, entityType, description, and sources.

- [ ] **Step 7: Populate territories.json with 3-4 snapshots**

Create 3-4 territory GeoJSON snapshots as simplified polygons:

- 264 BC (pre-Punic Wars) — Italian peninsula only
- 117 AD (peak under Trajan) — maximum extent
- 395 AD (East/West split) — two regions
- 476 AD (fall) — Eastern empire only

Each snapshot: id, name, year, boundaries (GeoJSON Feature with simplified Polygon), controlledBy (entity ID), status.

Use simplified polygon coordinates (4-8 points per region) — accuracy is secondary to demonstrating the feature.

- [ ] **Step 8: Populate connections.json with ~80-100 connections**

Link entities with appropriate connection types, strengths, years, and evidence. Examples:

- Caesar → Roman Senate: opposition, strength 3
- Caesar → Pompey: rivalry, then alliance, then opposition
- Augustus → Legio X: commanded, strength 2
- Hannibal → Scipio: defeated (by Scipio at Zama)
- Constantine → Edict of Milan: authored

- [ ] **Step 7: Create one guided story: "The Fall of the Republic"**

```json
[
  {
    "id": "fall-of-republic",
    "title": "The Fall of the Republic",
    "description": "Trace the chain of events from the Gracchi reforms to Caesar's assassination that ended 500 years of republican government.",
    "steps": [
      {
        "entityId": "gracchi-reforms",
        "text": "In 133 BC, Tiberius Gracchus proposed radical land reforms, breaking centuries of Senate tradition. His assassination set a dangerous precedent — political violence as a tool of the Republic.",
        "highlightConnections": []
      },
      {
        "entityId": "gaius-marius",
        "text": "Marius's military reforms created armies loyal to their generals, not the state. This shift would prove fatal to the Republic.",
        "highlightConnections": []
      },
      {
        "entityId": "sulla",
        "text": "Sulla marched his legions on Rome itself — the first time a Roman general turned his army against the city. He became dictator and rewrote the constitution.",
        "highlightConnections": []
      },
      {
        "entityId": "julius-caesar",
        "text": "Caesar crossed the Rubicon in 49 BC, following Sulla's precedent. After defeating Pompey, he was named dictator perpetuo — dictator in perpetuity.",
        "highlightConnections": []
      },
      {
        "entityId": "assassination-of-caesar",
        "text": "On the Ides of March, 44 BC, senators assassinated Caesar in the Theatre of Pompey. But they could not restore the Republic — the precedents were set.",
        "highlightConnections": []
      },
      {
        "entityId": "augustus",
        "text": "Octavian defeated all rivals and became Augustus, the first Emperor. The Republic was dead, replaced by the Principate — autocracy wearing a republican mask.",
        "highlightConnections": []
      }
    ]
  }
]
```

- [ ] **Step 8: Run data validation**

```bash
npm test -- src/data/
```

Expected: All validation tests pass — schemas valid, referential integrity holds.

- [ ] **Step 9: Verify the app end-to-end**

```bash
npm run dev
```

Expected: Landing page shows featured entities and the story. Graph shows connected nodes. Map shows markers at correct coordinates. Timeline shows entities on lanes. Stats shows summary counts. Clicking an entity opens detail panel. PathFinder finds paths. Story mode walks through steps.

- [ ] **Step 10: Commit**

```bash
git add src/data/
git commit -m "feat: add seed data — 30 people, 15 events, 15 locations, 5 orgs, 5 docs, legions, dynasties, religions, trade goods, infrastructure, territories, 100 connections, 1 story"
```

---

### Task 26: Data validation CLI script

**Files:**

- Create: `scripts/validate-data.ts`
- Modify: `package.json`

- [ ] **Step 1: Create validation script**

```typescript
// scripts/validate-data.ts
import { loadAndValidateData } from '../src/data/loader'

try {
  const data = loadAndValidateData()
  console.log(`✓ ${data.entities.length} entities validated`)
  console.log(`✓ ${data.connections.length} connections validated`)
  console.log(`✓ ${data.stories.length} stories validated`)

  // Check referential integrity
  const entityIds = new Set(data.entities.map((e) => e.id))
  let errors = 0
  for (const conn of data.connections) {
    if (!entityIds.has(conn.source)) {
      console.error(`✗ Connection ${conn.id}: source "${conn.source}" not found`)
      errors++
    }
    if (!entityIds.has(conn.target)) {
      console.error(`✗ Connection ${conn.id}: target "${conn.target}" not found`)
      errors++
    }
  }

  if (errors > 0) {
    console.error(`\n${errors} referential integrity error(s) found`)
    process.exit(1)
  }

  console.log('\n✓ All data valid')
} catch (e) {
  console.error('✗ Validation failed:', e)
  process.exit(1)
}
```

- [ ] **Step 2: Add script to package.json**

```json
"validate": "tsx scripts/validate-data.ts"
```

Install tsx: `npm install -D tsx`

- [ ] **Step 3: Add to lint-staged config**

Update `package.json` lint-staged to run validation when JSON data files change:

```json
"src/data/**/*.json": ["npm run validate"]
```

- [ ] **Step 4: Commit**

```bash
git add scripts/ package.json package-lock.json
git commit -m "chore: add data validation CLI script and pre-commit hook"
```

---

### Task 27: GitHub Actions CI

**Files:**

- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
      - run: npm run validate
```

- [ ] **Step 2: Commit**

```bash
git add .github/
git commit -m "chore: add GitHub Actions CI workflow"
```

---

### Task 28: Vercel deployment setup

**Files:**

- Create: `vercel.json` (if needed)
- Modify: `src/main.tsx` (add analytics)

- [ ] **Step 1: Add Vercel analytics**

Add the `<Analytics />` component to `src/app/providers.tsx`:

```tsx
import { Analytics } from '@vercel/analytics/react'

// Inside Providers, add <Analytics /> as a sibling to children:
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      {children}
      <Analytics />
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Create GitHub repo and push**

```bash
gh repo create Ancient-Rome --private --source=. --push
```

- [ ] **Step 3: Deploy to Vercel**

```bash
npx vercel --prod
```

Or connect the GitHub repo to Vercel dashboard for automatic deploys.

- [ ] **Step 4: Commit any Vercel config changes**

```bash
git add -A
git commit -m "chore: configure Vercel deployment with analytics"
```

---

### Task 29: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Run data validation**

```bash
npm run validate
```

Expected: All data valid.

- [ ] **Step 5: Manual verification**

Open `npm run dev` and verify:

- [ ] Landing page renders with hero, featured entities, story card
- [ ] Graph view shows force-directed network with colored nodes
- [ ] Clicking a node opens detail panel with entity info and connections
- [ ] Map view shows markers at correct locations on dark tile map
- [ ] Timeline view shows entities on lanes with era highlighting
- [ ] Stats view shows summary cards and charts
- [ ] Search finds entities by name
- [ ] PathFinder finds shortest path between entities
- [ ] Story mode walks through steps with narration
- [ ] Filters narrow displayed entities
- [ ] Lens switching works (Graph/Map/Timeline/Stats)
- [ ] Mobile responsive — detail panel becomes drawer
- [ ] URL params persist (entity, lens)
- [ ] Trail bar shows breadcrumbs

- [ ] **Step 6: Final commit and tag**

```bash
git add -A
git commit -m "chore: v0.1.0 — initial release"
git tag v0.1.0
```
