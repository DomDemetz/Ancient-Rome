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
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-text-primary">Dataset Statistics</h2>

          <SummaryCards />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TopConnected />
            <ConnectionDist />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
