import { useMemo } from 'react'
import { Swords, Bird, Anchor, Landmark } from 'lucide-react'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useMapLayerStore } from '@/stores/useMapLayerStore'
import { useUIStore } from '@/stores/useUIStore'

function interpolateRomePopulation(
  populations: { year: number; population: number }[],
  currentYear: number,
): number | null {
  if (populations.length === 0) return null

  const sorted = [...populations].sort((a, b) => a.year - b.year)

  // Before earliest data point
  if (currentYear <= sorted[0].year) return sorted[0].population

  // After latest data point
  if (currentYear >= sorted[sorted.length - 1].year) return sorted[sorted.length - 1].population

  // Find bracketing entries
  let lo = sorted[0]
  let hi = sorted[sorted.length - 1]
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].year <= currentYear && sorted[i + 1].year >= currentYear) {
      lo = sorted[i]
      hi = sorted[i + 1]
      break
    }
  }

  if (lo.year === hi.year) return lo.population

  const t = (currentYear - lo.year) / (hi.year - lo.year)
  return Math.round(lo.population + t * (hi.population - lo.population))
}

function formatPopulation(pop: number): string {
  if (pop >= 1_000_000) {
    const millions = pop / 1_000_000
    // Show 1 decimal place, strip trailing zero only if clean (e.g. 1.0M → 1M)
    const formatted = millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)
    return `${formatted}M`
  }
  return pop.toLocaleString()
}

function formatCount(n: number): string {
  return n.toLocaleString()
}

export function StatsOverlay() {
  const currentYear = useTimelineStore((s) => s.currentYear)
  const isMobile = useUIStore((s) => s.isMobile)

  const showBattles = useMapLayerStore((s) => s.showBattles)
  const battlesData = useMapLayerStore((s) => s.battlesData)
  const showLegions = useMapLayerStore((s) => s.showLegions)
  const legionsData = useMapLayerStore((s) => s.legionsData)
  const showShipwrecks = useMapLayerStore((s) => s.showShipwrecks)
  const shipwrecksData = useMapLayerStore((s) => s.shipwrecksData)
  const showSettlements = useMapLayerStore((s) => s.showSettlements)
  const cityPopulationsData = useMapLayerStore((s) => s.cityPopulationsData)

  const battleCount = useMemo(() => {
    if (!showBattles || !battlesData) return null
    return battlesData.filter((b) => b.year <= currentYear && currentYear - b.year < 50).length
  }, [showBattles, battlesData, currentYear])

  const legionCount = useMemo(() => {
    if (!showLegions || !legionsData) return null
    return legionsData.filter((l) => {
      if (l.founded > currentYear) return false
      if (l.dissolved != null && l.dissolved < currentYear) return false
      return l.bases.some((b) => b.fromYear <= currentYear && b.toYear >= currentYear)
    }).length
  }, [showLegions, legionsData, currentYear])

  const shipwreckCount = useMemo(() => {
    if (!showShipwrecks || !shipwrecksData) return null
    return shipwrecksData.filter((w) => w.startYear <= currentYear && w.endYear >= currentYear)
      .length
  }, [showShipwrecks, shipwrecksData, currentYear])

  const romePopulation = useMemo(() => {
    if (!showSettlements || !cityPopulationsData) return null
    const rome = cityPopulationsData.find(
      (c) =>
        c.name.toLowerCase() === 'rome' || c.latinVariants.some((v) => v.toLowerCase() === 'roma'),
    )
    if (!rome) return null
    return interpolateRomePopulation(rome.populations, currentYear)
  }, [showSettlements, cityPopulationsData, currentYear])

  const stats: {
    Icon: React.ComponentType<{ className?: string }>
    label: string
    value: string
  }[] = []

  if (battleCount !== null) {
    stats.push({ Icon: Swords, label: 'battles', value: formatCount(battleCount) })
  }
  if (legionCount !== null) {
    stats.push({ Icon: Bird, label: 'legions', value: formatCount(legionCount) })
  }
  if (shipwreckCount !== null) {
    stats.push({ Icon: Anchor, label: 'wrecks', value: formatCount(shipwreckCount) })
  }
  if (romePopulation !== null) {
    stats.push({ Icon: Landmark, label: 'Rome', value: formatPopulation(romePopulation) })
  }

  if (stats.length === 0) return null

  // Mobile: minimal inline pills at top-left, below any emperor banner
  if (isMobile) {
    return (
      <div className="absolute top-2 left-2 z-[1000] pointer-events-none">
        <div className="flex items-center gap-1.5">
          {stats.map((s) => (
            <span
              key={s.label}
              className="flex items-center gap-1 bg-black/70 rounded-full px-2 py-0.5 text-[9px] tabular-nums"
            >
              <s.Icon className="w-3 h-3 text-slate-500" />
              <span className="font-semibold text-slate-200">{s.value}</span>
            </span>
          ))}
        </div>
      </div>
    )
  }

  // Desktop: full stats bar
  return (
    <div className="absolute top-3 left-3 z-[1000] pointer-events-none">
      <div className="bg-[#0a0a0c]/85 backdrop-blur-md border border-white/[0.08] rounded-xl px-3.5 py-2 text-[11px] tabular-nums shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex items-center gap-4 whitespace-nowrap">
        {stats.map((s, i) => (
          <span key={s.label} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-700">&middot;</span>}
            <s.Icon className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold text-slate-100">{s.value}</span>
            <span className="text-slate-500">{s.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
