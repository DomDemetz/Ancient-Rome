import { PanelLeft, BookOpen, Shield } from 'lucide-react'
import { useState } from 'react'
import { LensSwitcher } from './LensSwitcher'
import { SearchBar } from '@/features/search/SearchBar'
import { useUIStore } from '@/stores/useUIStore'
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/dialog'
import { StoryPlayer } from '@/features/stories/StoryPlayer'
import type { useStoryMode } from '@/features/stories/useStoryMode'
import type { Story } from '@/types'

interface TopBarProps {
  storyMode: ReturnType<typeof useStoryMode>
}

export function TopBar({ storyMode }: TopBarProps) {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const isMobile = useUIStore((s) => s.isMobile)
  const [dialogOpen, setDialogOpen] = useState(false)

  function handleStart(story: Story) {
    storyMode.enter(story)
    setDialogOpen(false)
  }

  return (
    <header
      className={`flex items-center gap-3 border-b border-white/10 px-4 shrink-0 relative bg-[#0f0a1a]/80 backdrop-blur-md ${
        isMobile ? 'h-14' : 'h-16'
      }`}
      style={{ zIndex: 1000 }}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => toggleSidebar()}
        className="text-text-secondary hover:text-text-primary"
        aria-label="Toggle sidebar"
      >
        <PanelLeft />
      </Button>

      <div className="flex items-center gap-2">
        <div className="bg-accent-gold p-1.5 rounded-lg">
          <Shield className="size-4 text-black" />
        </div>
        {!isMobile && (
          <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-amber-600">
            Ancient Rome
          </span>
        )}
      </div>

      <SearchBar />
      <div className="flex-1" />

      {/* Stories button */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="text-text-secondary hover:text-text-primary gap-1.5"
              aria-label="Browse stories"
            />
          }
        >
          <BookOpen className="size-4" />
          <span className="hidden sm:inline">Stories</span>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Guided Stories</DialogTitle>
          </DialogHeader>
          <StoryPlayer onStart={handleStart} />
        </DialogContent>
      </Dialog>

      <LensSwitcher />
    </header>
  )
}
