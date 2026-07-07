import { useMemo } from 'react'
import type { Emperor } from '@/data/emperors'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useUIStore } from '@/stores/useUIStore'
import { formatYear } from '@/lib/geo'

interface EmperorBannerProps {
  emperors: Emperor[]
}

export function EmperorBanner({ emperors }: EmperorBannerProps) {
  const currentYear = useTimelineStore((s) => s.currentYear)
  const isMobile = useUIStore((s) => s.isMobile)

  const currentEmperor = useMemo(() => {
    return emperors.find((e) => e.reignStart <= currentYear && e.reignEnd >= currentYear)
  }, [emperors, currentYear])

  if (!currentEmperor) return null

  const dynastyColors: Record<string, string> = {
    'Julio-Claudian': '#8b5cf6',
    Flavian: '#f59e0b',
    'Nerva-Antonine': '#10b981',
    Severan: '#ef4444',
    Crisis: '#6b7280',
    Tetrarchy: '#3b82f6',
    Constantinian: '#d4af37',
    Valentinianic: '#ec4899',
    Theodosian: '#14b8a6',
    // Byzantine (Eastern Roman) dynasties
    Leonid: '#a855f7',
    Justinian: '#eab308',
    Heraclian: '#0ea5e9',
    Isaurian: '#f97316',
    Amorian: '#84cc16',
    Macedonian: '#fbbf24',
    Doukas: '#06b6d4',
    Komnenian: '#e11d48',
    Angelos: '#94a3b8',
    Laskarid: '#22c55e',
    Palaiologan: '#7c3aed',
  }

  const dynastyColor = currentEmperor.dynasty
    ? dynastyColors[currentEmperor.dynasty] || '#9ca3af'
    : '#9ca3af'

  return (
    <div
      className={`absolute z-[1000] pointer-events-none ${
        isMobile ? 'top-8 left-2' : 'top-3 left-1/2 -translate-x-1/2'
      }`}
    >
      <div
        className={`bg-[#0a0a0c]/85 backdrop-blur-md border border-white/[0.08] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex items-center gap-2.5 ${
          isMobile ? 'px-3 py-1.5' : 'px-5 py-2'
        }`}
        style={{
          borderColor: dynastyColor + '60',
        }}
      >
        <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: dynastyColor }} />
        <div className="flex flex-col">
          <span className="text-sm font-semibold font-serif italic text-white/90">
            {currentEmperor.name}
          </span>
          {!isMobile && (
            <span className="text-[9px] uppercase tracking-[0.1em] text-slate-500">
              {/* "Justinian I / JUSTINIAN" read as a stutter — say what the
                  subtitle IS. Crisis and Tetrarchy aren't dynasties. */}
              {currentEmperor.dynasty &&
                `${currentEmperor.dynasty}${
                  ['Crisis', 'Tetrarchy'].includes(currentEmperor.dynasty) ? '' : ' dynasty'
                } · `}
              {formatYear(currentEmperor.reignStart)} &ndash; {formatYear(currentEmperor.reignEnd)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
