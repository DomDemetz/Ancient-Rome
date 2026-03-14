interface MapControlsProps {
  showTerritories: boolean
  onToggleTerritories: () => void
}

export function MapControls({ showTerritories, onToggleTerritories }: MapControlsProps) {
  return (
    <div
      className="absolute top-3 right-3 z-[1000] flex flex-col gap-1"
      style={{ pointerEvents: 'all' }}
    >
      <button
        onClick={onToggleTerritories}
        className={[
          'px-3 py-1.5 text-xs font-medium rounded border transition-colors',
          showTerritories
            ? 'bg-red-900/80 border-red-700 text-red-100 hover:bg-red-800/80'
            : 'bg-black/60 border-white/20 text-white/70 hover:bg-black/80',
        ].join(' ')}
        title="Toggle territory layer"
      >
        Territories
      </button>
    </div>
  )
}
