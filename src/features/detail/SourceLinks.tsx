import { ExternalLink } from 'lucide-react'

interface SourceLinksProps {
  sources: string[]
}

export function SourceLinks({ sources }: SourceLinksProps) {
  if (sources.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Sources</p>
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
                  className="flex items-center gap-1 text-xs text-accent-blue hover:underline truncate"
                >
                  <ExternalLink className="size-3 shrink-0" />
                  <span className="truncate">{src}</span>
                </a>
              ) : (
                <p className="text-xs text-text-secondary">{src}</p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
