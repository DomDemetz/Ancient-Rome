import { AboutDialog } from './AboutDialog'
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
  const lens = useUIStore((s) => s.lens)
  const atlasMode = useUIStore((s) => s.atlasMode)
  const [dialogOpen, setDialogOpen] = useState(false)

  function handleStart(story: Story) {
    storyMode.enter(story)
    setDialogOpen(false)
  }

  if (isMobile) {
    return (
      <header
        className={`flex items-center gap-2 px-3 h-11 shrink-0 backdrop-blur-2xl ${atlasMode ? 'bg-black/40 border-b border-amber-500/15' : 'bg-black/70 border-b border-amber-500/15'}`}
        style={{ zIndex: 1000, paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Sidebar toggle — graph only */}
        {lens === 'graph' && (
          <button
            onClick={() => toggleSidebar()}
            className="flex items-center justify-center size-9 min-w-[44px] min-h-[44px] rounded-lg text-slate-400 active:text-white transition-colors"
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="size-4" />
          </button>
        )}

        {/* Logo mark */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-700 p-1 rounded-md">
          <Shield className="size-3.5 text-white" />
        </div>
        <span className="font-serif italic text-amber-500/70 text-xs tracking-wide">
          Ancient Rome
        </span>

        <div className="flex-1" />

        {/* Stories */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <button
                className="flex items-center justify-center size-9 min-w-[44px] min-h-[44px] rounded-lg text-slate-500 active:text-white transition-colors"
                aria-label="Browse stories"
              />
            }
          >
            <BookOpen className="size-4" />
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-[#0c0c10] border border-white/[0.06] shadow-[0_16px_64px_rgba(0,0,0,0.7)]">
            <DialogHeader>
              <DialogTitle className="font-serif italic text-amber-500/70 text-lg">
                {atlasMode ? 'Atlas Tours' : 'Guided Stories'}
              </DialogTitle>
            </DialogHeader>
            <StoryPlayer onStart={handleStart} />
          </DialogContent>
        </Dialog>
        <AboutDialog />

        {/* Search */}
        <SearchBar />
      </header>
    )
  }

  return (
    <header
      className={`flex items-center shrink-0 relative backdrop-blur-2xl ${
        atlasMode
          ? 'gap-3 px-4 h-11 bg-black/40 border-b border-white/[0.04]'
          : 'gap-5 px-6 h-14 bg-[#0a0a0c]/90 border-b border-white/[0.08] shadow-[0_1px_12px_rgba(0,0,0,0.4)]'
      }`}
      style={{ zIndex: 1000 }}
    >
      {lens === 'graph' && (
        <button
          onClick={() => toggleSidebar()}
          className="flex items-center justify-center size-8 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="size-4" />
        </button>
      )}

      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-br from-amber-500 to-orange-700 p-1.5 rounded-lg shadow-[0_2px_16px_rgba(180,83,9,0.3)]">
          <Shield className="size-4.5 text-white" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-serif italic text-amber-500/90 text-sm tracking-wide">
            Ancient Rome
          </span>
          <span className="text-[8px] uppercase tracking-[0.3em] text-slate-500">
            {atlasMode ? 'Historical Atlas' : 'Investigation Board'}
          </span>
        </div>
      </div>

      {/* Vertical separator */}
      <div className="w-px h-6 bg-white/[0.06]" />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger
          render={
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors text-xs"
              aria-label="Browse stories"
            />
          }
        >
          <BookOpen className="size-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-[0.1em]">Stories</span>
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-[#0c0c10] border border-white/[0.08] shadow-[0_16px_64px_rgba(0,0,0,0.7)]">
          <DialogHeader>
            <DialogTitle className="font-serif italic text-amber-500/70 text-lg">
              {atlasMode ? 'Atlas Tours' : 'Guided Stories'}
            </DialogTitle>
          </DialogHeader>
          <StoryPlayer onStart={handleStart} />
        </DialogContent>
      </Dialog>
      <AboutDialog />

      <SearchBar />
      <div className="flex-1" />

      {!atlasMode && <LensSwitcher />}
    </header>
  )
}
