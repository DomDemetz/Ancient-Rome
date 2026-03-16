import { ExternalLink, BookMarked } from 'lucide-react'

interface SourceLinksProps {
  sources: string[]
}

export function SourceLinks({ sources }: SourceLinksProps) {
  if (sources.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/50 flex items-center gap-1.5">
          <BookMarked className="size-3.5" />
          Sources
        </span>
        <div className="flex-1 h-px bg-white/[0.05]" />
      </div>
      <ul className="space-y-1">
        {sources.map((src) => {
          const isUrl = src.startsWith('http://') || src.startsWith('https://')
          return (
            <li key={src}>
              {isUrl ? (
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 hover:underline truncate"
                >
                  <ExternalLink className="size-3 shrink-0" />
                  <span className="truncate">{src}</span>
                </a>
              ) : (
                <p className="text-xs text-slate-500">{src}</p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
