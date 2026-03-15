import { useMemo } from 'react'
import type { Emperor } from '@/data/emperors'
import { useTimelineStore } from '@/stores/useTimelineStore'

interface EmperorBannerProps {
  emperors: Emperor[]
}

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`
  return `${year} AD`
}

export function EmperorBanner({ emperors }: EmperorBannerProps) {
  const currentYear = useTimelineStore((s) => s.currentYear)

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
        className="px-4 py-2 rounded-lg border backdrop-blur-sm flex items-center gap-3"
        style={{
          backgroundColor: 'rgba(15, 10, 26, 0.85)',
          borderColor: dynastyColor + '60',
        }}
      >
        <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: dynastyColor }} />
        <div className="flex flex-col">
          <span className="text-sm font-bold text-white/90">{currentEmperor.name}</span>
          <span className="text-[10px] text-white/50">
            {currentEmperor.dynasty && `${currentEmperor.dynasty} · `}
            {formatYear(currentEmperor.reignStart)} &ndash; {formatYear(currentEmperor.reignEnd)}
          </span>
        </div>
      </div>
    </div>
  )
}
