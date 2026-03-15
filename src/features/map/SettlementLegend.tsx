import { useState } from 'react'
import { ALL_CATEGORIES, CATEGORY_STYLES } from './settlementStyles'
import type { SettlementCategory } from './settlementStyles'

interface SettlementLegendProps {
  hiddenCategories: Set<string>
  onToggleCategory: (category: SettlementCategory) => void
}

export function SettlementLegend({ hiddenCategories, onToggleCategory }: SettlementLegendProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div
      className="absolute bottom-6 left-3 z-[1000] rounded-lg shadow-lg"
      style={{
        background: 'rgba(15, 10, 26, 0.88)',
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(8px)',
        fontSize: '12px',
        color: '#ddd',
        maxWidth: '200px',
      }}
    >
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 cursor-pointer"
        style={{
          background: 'none',
          border: 'none',
          color: '#ccc',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        <span>Settlements</span>
        <span style={{ fontSize: '10px' }}>{collapsed ? '▶' : '▼'}</span>
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
                className="flex items-center gap-2 cursor-pointer"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '1px 0',
                  color: hidden ? '#666' : '#ddd',
                  fontSize: '12px',
                  textAlign: 'left',
                  opacity: hidden ? 0.5 : 1,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: style.color,
                    flexShrink: 0,
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
