import { useState, useEffect } from 'react'
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import type { Story } from './StoryPlayer'

interface StorySelectorProps {
  onSelect: (story: Story) => void
}

export function StorySelector({ onSelect }: StorySelectorProps) {
  const [stories, setStories] = useState<Story[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open && stories.length === 0) {
      import('@/data/stories/stories.json').then((mod) => {
        setStories(mod.default as unknown as Story[])
      })
    }
  }, [open, stories.length])

  return (
    <div
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[1000]"
      style={{ pointerEvents: 'all' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-black/70 backdrop-blur-xl border border-white/[0.06] text-slate-300 hover:text-white transition-all shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
      >
        <BookOpen className="size-3.5 text-amber-500" />
        <span className="text-[10px] font-bold uppercase tracking-[0.15em]">Stories</span>
        {open ? (
          <ChevronDown className="size-3 text-slate-500" />
        ) : (
          <ChevronUp className="size-3 text-slate-500" />
        )}
      </button>

      {open && stories.length > 0 && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 rounded-2xl border border-white/[0.06] bg-[#0c0c10] shadow-[0_8px_32px_rgba(0,0,0,0.6)] p-2 space-y-0.5">
          {stories.map((story) => (
            <button
              key={story.id}
              onClick={() => {
                onSelect(story)
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl border border-transparent hover:bg-white/[0.03] hover:border-white/[0.05] transition-all group"
            >
              <div className="text-xs font-serif italic text-slate-200 group-hover:text-amber-500 transition-colors">
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
