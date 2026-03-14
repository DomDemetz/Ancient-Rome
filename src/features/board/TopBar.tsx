import { PanelLeft } from 'lucide-react'
import { LensSwitcher } from './LensSwitcher'
import { SearchBar } from '@/features/search/SearchBar'
import { useUIStore } from '@/stores/useUIStore'
import { Button } from '@/ui/button'

export function TopBar() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  return (
    <header className="flex h-12 items-center gap-3 border-b border-border px-4 shrink-0">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => toggleSidebar()}
        className="text-text-secondary hover:text-text-primary"
        aria-label="Toggle sidebar"
      >
        <PanelLeft />
      </Button>
      <span className="text-lg font-bold text-accent-gold">Ancient Rome</span>
      <SearchBar />
      <div className="flex-1" />
      <LensSwitcher />
    </header>
  )
}
