import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

interface GraphControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}

export function GraphControls({ onZoomIn, onZoomOut, onReset }: GraphControlsProps) {
  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-0.5 bg-black/80 backdrop-blur-md border border-white/[0.06] rounded-xl p-1 z-10 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
      <button
        onClick={onZoomIn}
        className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white active:text-white hover:bg-white/[0.08] active:bg-white/[0.08] rounded-lg transition-colors"
        aria-label="Zoom in"
      >
        <ZoomIn className="size-4" />
      </button>
      <div className="mx-1.5 h-px bg-white/[0.06]" />
      <button
        onClick={onZoomOut}
        className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white active:text-white hover:bg-white/[0.08] active:bg-white/[0.08] rounded-lg transition-colors"
        aria-label="Zoom out"
      >
        <ZoomOut className="size-4" />
      </button>
      <div className="mx-1.5 h-px bg-white/[0.06]" />
      <button
        onClick={onReset}
        className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white active:text-white hover:bg-white/[0.08] active:bg-white/[0.08] rounded-lg transition-colors"
        aria-label="Reset zoom"
      >
        <Maximize2 className="size-4" />
      </button>
    </div>
  )
}
