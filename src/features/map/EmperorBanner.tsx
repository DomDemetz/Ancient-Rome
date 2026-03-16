import { useMemo } from 'react'
import type { Emperor } from '@/data/emperors'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { useUIStore } from '@/stores/useUIStore'

interface EmperorBannerProps {
  emperors: Emperor[]
}

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`
  return `${year} AD`
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
  }

  const dynastyColor = currentEmperor.dynasty
    ? dynastyColors[currentEmperor.dynasty] || '#9ca3af'
    : '#9ca3af'

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
      <div
        className={`bg-black/70 backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center gap-2.5 ${
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
              {currentEmperor.dynasty && `${currentEmperor.dynasty} · `}
              {formatYear(currentEmperor.reignStart)} &ndash; {formatYear(currentEmperor.reignEnd)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
