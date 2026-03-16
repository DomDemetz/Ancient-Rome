interface GraphControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}

export function GraphControls({ onZoomIn, onZoomOut, onReset }: GraphControlsProps) {
  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-1 bg-white/[0.03] border border-white/[0.06] rounded p-1 z-10">
      <button
        onClick={onZoomIn}
        className="w-8 h-8 flex items-center justify-center text-slate-100 hover:bg-white/[0.04] rounded text-lg leading-none"
        aria-label="Zoom in"
      >
        +
      </button>
      <button
        onClick={onZoomOut}
        className="w-8 h-8 flex items-center justify-center text-slate-100 hover:bg-white/[0.04] rounded text-lg leading-none"
        aria-label="Zoom out"
      >
        −
      </button>
      <button
        onClick={onReset}
        className="w-8 h-8 flex items-center justify-center text-slate-100 hover:bg-white/[0.04] rounded text-lg leading-none"
        aria-label="Reset zoom"
      >
        ⟲
      </button>
    </div>
  )
}
