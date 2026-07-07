import { Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog'

const SOURCES: Array<{ name: string; what: string; license: string; url: string }> = [
  { name: 'Pleiades', what: 'ancient places', license: 'CC BY', url: 'https://pleiades.stoa.org' },
  { name: 'DARE / AWMC', what: 'settlements, roads, provinces', license: 'CC BY / ODbL', url: 'https://imperium.ahlfeldt.se' },
  { name: 'Vici.org', what: 'archaeological sites', license: 'CC BY-SA', url: 'https://vici.org' },
  { name: 'Cliopatria (Seshat)', what: 'every polity on earth, 3400 BC – present', license: 'CC BY 4.0', url: 'https://github.com/Seshat-Global-History-Databank/cliopatria' },
  { name: 'Chandler & Reba et al.', what: 'city populations over 6,000 years', license: 'CC BY', url: 'https://www.nature.com/articles/sdata201634' },
  { name: 'ORBIS (Stanford)', what: 'travel & trade network', license: 'MIT', url: 'https://orbis.stanford.edu' },
  { name: 'Wikidata / Wikipedia', what: 'identity & knowledge', license: 'CC0 / CC BY-SA', url: 'https://www.wikidata.org' },
  { name: 'Natural Earth', what: 'coastlines', license: 'Public domain', url: 'https://www.naturalearthdata.com' },
]

/** The open-data story is the product's credibility — one click from the
 *  header instead of buried in a hover. */
export function AboutDialog() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            className="flex items-center justify-center size-9 min-w-[44px] min-h-[44px] rounded-lg text-slate-500 hover:text-slate-300 active:text-white transition-colors"
            aria-label="About this atlas"
          />
        }
      >
        <Info className="size-4" />
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-[#0c0c10] border border-white/[0.06] shadow-[0_16px_64px_rgba(0,0,0,0.7)] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif italic text-amber-500/80 text-lg">
            Atlas of Ancient Rome
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-slate-300">
          <p className="leading-relaxed">
            An open atlas of the Roman world — every empire, city, road and
            battle from the founding of Rome to the fall of Constantinople,
            753 BC to 1453 AD, on one timeline.
          </p>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-amber-500/60 mb-2">
              Built entirely on open data
            </p>
            <div className="space-y-1.5">
              {SOURCES.map((s) => (
                <div key={s.name} className="flex items-baseline gap-2 text-xs">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-300/90 hover:text-amber-200 shrink-0 underline-offset-2 hover:underline"
                  >
                    {s.name}
                  </a>
                  <span className="text-slate-500 flex-1">{s.what}</span>
                  <span className="text-[10px] text-slate-600 shrink-0">{s.license}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Open source —{' '}
            <a
              href="https://github.com/DomDemetz/Ancient-Rome"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-300/90 hover:text-amber-200 underline-offset-2 hover:underline"
            >
              code &amp; data on GitHub
            </a>
            . Corrections and contributions welcome; every place links back
            to its scholarly source.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
