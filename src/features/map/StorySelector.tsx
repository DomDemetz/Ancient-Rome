import { useState } from 'react'
import { BookOpen, ChevronDown } from 'lucide-react'
import { useUIStore } from '@/stores/useUIStore'
import { stories } from '@/data'
import type { Story } from './StoryPlayer'

interface StorySelectorProps {
  onSelect: (story: Story) => void
}

export function StorySelector({ onSelect }: StorySelectorProps) {
  const isMobile = useUIStore((s) => s.isMobile)
  const [open, setOpen] = useState(false)

  // On mobile, the TopBar's Stories dialog handles this
  if (isMobile) return null

  return (
    <div className="absolute top-3 right-16 z-[1000]" style={{ pointerEvents: 'all' }}>
      <button
        onClick={() => setOpen(!open)}
        className={`group flex items-center gap-2 rounded-xl backdrop-blur-md border transition-all duration-200 shadow-[0_4px_24px_rgba(0,0,0,0.5)] px-3 py-2.5 ${
          open
            ? 'bg-amber-500/15 border-amber-500/25 text-amber-400'
            : 'bg-[#0a0a0c]/85 border-white/[0.08] text-slate-400 hover:text-white hover:border-white/[0.12] active:text-amber-400'
        }`}
      >
        <BookOpen className="size-4" />
        <span
          className={`text-[10px] font-bold uppercase tracking-[0.1em] transition-all duration-200 ${
            open
              ? 'opacity-100'
              : 'opacity-0 w-0 overflow-hidden group-hover:opacity-100 group-hover:w-auto'
          }`}
        >
          Stories
        </span>
        {open ? <ChevronDown className="size-3 text-amber-400/60" /> : null}
      </button>

      {open && stories.length > 0 && (
        <div className="absolute top-full mt-2 right-0 w-72 rounded-xl border border-white/[0.08] bg-[#0a0a0c]/95 backdrop-blur-md shadow-[0_8px_40px_rgba(0,0,0,0.6)] p-1.5 space-y-0.5">
          {stories.map((story) => (
            <button
              key={story.id}
              onClick={() => {
                onSelect(story)
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/[0.04] active:bg-white/[0.06] transition-all group"
            >
              <div className="text-xs font-serif italic text-slate-200 group-hover:text-amber-400 transition-colors">
                {story.title}
              </div>
              <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                {story.description}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
