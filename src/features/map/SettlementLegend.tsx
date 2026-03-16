import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ALL_CATEGORIES, CATEGORY_STYLES } from './settlementStyles'
import type { SettlementCategory } from './settlementStyles'
import { useUIStore } from '@/stores/useUIStore'

interface SettlementLegendProps {
  hiddenCategories: Set<string>
  onToggleCategory: (category: SettlementCategory) => void
}

export function SettlementLegend({ hiddenCategories, onToggleCategory }: SettlementLegendProps) {
  const isMobile = useUIStore((s) => s.isMobile)
  const [collapsed, setCollapsed] = useState(isMobile)

  return (
    <div className="absolute bottom-6 left-3 z-[1000] bg-black/70 backdrop-blur-xl border border-white/[0.05] rounded-2xl shadow-lg text-xs text-[#ddd] max-w-[200px]">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 cursor-pointer bg-transparent border-none text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400"
      >
        <span>Settlements</span>
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>

      {!collapsed && (
        <div className="px-3 pb-2 flex flex-col gap-1">
          {ALL_CATEGORIES.map((cat) => {
            const style = CATEGORY_STYLES[cat]
            const hidden = hiddenCategories.has(cat)
            return (
              <button
                key={cat}
                onClick={() => onToggleCategory(cat)}
                className={`flex items-center gap-2 cursor-pointer bg-transparent border-none py-px text-left text-xs ${
                  hidden ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    background: style.color,
                    opacity: hidden ? 0.3 : 1,
                  }}
                />
                <span>{style.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
