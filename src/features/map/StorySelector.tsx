import { useState, useEffect } from 'react'
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
    <div className="absolute bottom-20 left-3 z-[1000]" style={{ pointerEvents: 'all' }}>
      <button
        onClick={() => setOpen(!open)}
        className={[
          'px-3 py-1.5 text-xs font-bold rounded border transition-colors',
          open
            ? 'bg-amber-900/80 border-amber-600 text-amber-100'
            : 'bg-black/60 border-amber-700/50 text-amber-200/80 hover:bg-black/80',
        ].join(' ')}
      >
        {open ? '\u25BC' : '\u25B6'} Stories
      </button>

      {open && stories.length > 0 && (
        <div className="mt-1 flex flex-col gap-1 rounded border border-white/10 bg-black/90 p-2 w-56">
          {stories.map((story) => (
            <button
              key={story.id}
              onClick={() => {
                onSelect(story)
                setOpen(false)
              }}
              className="text-left px-2 py-1.5 rounded hover:bg-white/10 transition-colors"
            >
              <div className="text-xs font-semibold text-white/90">{story.title}</div>
              <div className="text-[10px] text-white/50 line-clamp-2">{story.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
