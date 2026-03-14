import { BookOpen } from 'lucide-react'
import { Button } from '@/ui/button'
import { stories } from '@/data'
import type { Story } from '@/types'

interface StoryPlayerProps {
  onStart: (story: Story) => void
}

export function StoryPlayer({ onStart }: StoryPlayerProps) {
  if (stories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <BookOpen className="size-8 text-text-secondary" />
        <p className="text-sm text-text-secondary">No stories available yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {stories.map((story) => (
        <div key={story.id} className="rounded-lg border border-border bg-bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">{story.title}</p>
              <p className="text-xs text-text-secondary mt-1 line-clamp-2">{story.description}</p>
              <p className="text-xs text-text-secondary mt-1.5">
                {story.steps.length} step{story.steps.length !== 1 ? 's' : ''}
                {story.tags && story.tags.length > 0 && (
                  <span className="ml-2 text-accent-gold">{story.tags.slice(0, 3).join(', ')}</span>
                )}
              </p>
            </div>
            <Button size="sm" className="shrink-0" onClick={() => onStart(story)}>
              Start Story
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
