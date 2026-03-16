import { PanelLeft, BookOpen, Shield } from 'lucide-react'
import { useState } from 'react'
import { LensSwitcher } from './LensSwitcher'
import { SearchBar } from '@/features/search/SearchBar'
import { useUIStore } from '@/stores/useUIStore'
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
      className={`flex items-center gap-4 border-b border-white/[0.05] px-6 shrink-0 relative bg-black/60 backdrop-blur-2xl ${
        isMobile ? 'h-14' : 'h-16'
      }`}
      style={{ zIndex: 1000 }}
    >
      <button
        onClick={() => toggleSidebar()}
        className="flex items-center justify-center size-8 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
        aria-label="Toggle sidebar"
      >
        <PanelLeft className="size-4" />
      </button>

      <div className="flex items-center gap-2">
        <div className="bg-gradient-to-br from-amber-500 to-orange-700 p-1.5 rounded-xl shadow-lg shadow-amber-900/20">
          <Shield className="size-4 text-white" />
        </div>
        {!isMobile && (
          <span className="font-serif italic text-amber-500/70 text-sm tracking-wide">
            Ancient Rome
          </span>
        )}
      </div>

      {/* Stories — next to logo, away from map data */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger
          render={
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors text-xs"
              aria-label="Browse stories"
            />
          }
        >
          <BookOpen className="size-3.5" />
          <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-[0.1em]">
            Stories
          </span>
        </DialogTrigger>
        <DialogContent className="max-w-lg bg-[#0c0c10] border border-white/[0.06] shadow-[0_16px_64px_rgba(0,0,0,0.7)]">
          <DialogHeader>
            <DialogTitle className="font-serif italic text-amber-500/70 text-lg">
              Guided Stories
            </DialogTitle>
          </DialogHeader>
          <StoryPlayer onStart={handleStart} />
        </DialogContent>
      </Dialog>

      <SearchBar />
      <div className="flex-1" />

      <LensSwitcher />
    </header>
  )
}
