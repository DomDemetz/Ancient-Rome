import { ScrollArea } from '@/ui/scroll-area'
import { SummaryCards } from './SummaryCards'
import { TopConnected } from './TopConnected'
import { ConnectionDist } from './ConnectionDist'
import { CenturyChart } from './CenturyChart'
import { RegionChart } from './RegionChart'
import { ChordDiagram } from './ChordDiagram'
import { PowerRankings } from './PowerRankings'

export function StatsView() {
  return (
    <div className="w-full h-full overflow-hidden">
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-500/60 shrink-0">
              Dataset Statistics
            </h2>
            <div className="flex-1 h-px bg-gradient-to-l from-white/[0.06] to-transparent" />
          </div>

          <SummaryCards />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <TopConnected />
            <ConnectionDist />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CenturyChart />
            <RegionChart />
            <ChordDiagram />
            <PowerRankings />
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
