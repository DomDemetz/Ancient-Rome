import { BookOpen } from 'lucide-react'
import { stories } from '@/data'
import type { Story } from '@/types'

interface StoryPlayerProps {
  onStart: (story: Story) => void
}

export function StoryPlayer({ onStart }: StoryPlayerProps) {
  if (stories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <BookOpen className="size-8 text-slate-500" />
        <p className="text-sm text-slate-500">No stories available yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {stories.map((story) => (
        <div
          key={story.id}
          className="group rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5 hover:border-amber-500/20 transition-all"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-serif italic text-base text-slate-100 group-hover:text-amber-500 transition-colors">
                {story.title}
              </p>
              <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                {story.description}
              </p>
              <p className="text-[10px] text-slate-600 mt-2 uppercase tracking-[0.15em] font-bold">
                {story.steps.length} step{story.steps.length !== 1 ? 's' : ''}
                {story.tags && story.tags.length > 0 && (
                  <span className="ml-2 text-amber-500/60">
                    {story.tags.slice(0, 3).join(' · ')}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => onStart(story)}
              className="shrink-0 px-4 py-2 rounded-full border border-amber-500/40 text-amber-400 hover:bg-amber-600 hover:border-amber-600 hover:text-white text-[10px] font-bold uppercase tracking-[0.15em] active:scale-[0.97] transition-all"
            >
              Start
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
