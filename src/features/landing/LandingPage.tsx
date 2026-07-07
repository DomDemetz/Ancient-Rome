import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Compass, ArrowRight, Star, BookOpen, Footprints } from 'lucide-react'
import { entities, connections, stories } from '@/data'
import { entityIcons, entityLabels } from '@/lib/colors'

export function LandingPage() {
  const navigate = useNavigate()

  const featured = useMemo(() => {
    const countMap = new Map<string, number>()
    for (const c of connections) {
      countMap.set(c.source, (countMap.get(c.source) ?? 0) + 1)
      countMap.set(c.target, (countMap.get(c.target) ?? 0) + 1)
    }
    return [...entities]
      .sort((a, b) => (countMap.get(b.id) ?? 0) - (countMap.get(a.id) ?? 0))
      .slice(0, 6)
  }, [])

  return (
    <div className="min-h-dvh bg-[#0a0a0c] vignette">
      {/* Hero Section */}
      <section className="relative flex min-h-[75dvh] flex-col items-center justify-center px-4 text-center overflow-hidden">
        {/* Layered ambient spotlights */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse,rgba(245,158,11,0.06),transparent_60%)] pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[radial-gradient(circle,rgba(180,83,9,0.08),transparent_70%)] pointer-events-none blur-2xl" />

        {/* Decorative rule */}
        <div className="flex items-center gap-4 mb-8 animate-fade-up">
          <div className="w-12 h-px bg-gradient-to-r from-transparent to-amber-700/40" />
          <Compass className="size-8 text-amber-600/50" strokeWidth={1.5} />
          <div className="w-12 h-px bg-gradient-to-l from-transparent to-amber-700/40" />
        </div>

        <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-amber-600/40 mb-5 animate-fade-up stagger-1">
          An Interactive Atlas
        </p>

        <h1 className="mb-6 font-serif italic text-5xl md:text-7xl lg:text-8xl tracking-tight bg-gradient-to-b from-amber-300 via-amber-500 to-orange-700 bg-clip-text text-transparent leading-[1.05] animate-fade-up stagger-2">
          Atlas of Ancient Rome
        </h1>

        <p className="mb-12 max-w-xl text-base text-slate-500 md:text-lg leading-relaxed animate-fade-up stagger-3">
          From the founding of Rome to the fall of Constantinople — twenty-two centuries of
          emperors, legions, cities and the trade routes that bound an empire, on one map.
        </p>

        <button
          onClick={() => navigate('/investigate')}
          className="group inline-flex items-center gap-3 bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white rounded-full px-10 py-4 text-[11px] font-bold uppercase tracking-[0.3em] shadow-[0_8px_40px_rgba(180,83,9,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.97] transition-all animate-fade-up stagger-4"
        >
          Explore the Atlas
          <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
          <span className="text-[9px] uppercase tracking-[0.3em] text-slate-500">Scroll</span>
          <div className="w-px h-6 bg-gradient-to-b from-slate-500 to-transparent" />
        </div>
      </section>

      {/* Data stats ribbon */}
      <section className="mx-auto max-w-4xl px-4 pb-16">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-center">
          {[
            ['35,900+', 'Settlements'],
            ['22,100+', 'Archaeological Sites'],
            ['5,700+', 'Buildings & Structures'],
            ['2,283', 'Historical Figures'],
            ['374', 'Battles'],
            ['126', 'Emperors'],
          ].map(([n, label]) => (
            <div key={label} className="flex items-baseline gap-1.5">
              <span className="font-serif italic text-xl text-amber-500/80">{n}</span>
              <span className="text-[9px] uppercase tracking-[0.2em] text-slate-600">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Entities */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="flex items-center justify-center gap-4 mb-10">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
            <h2 className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.3em] text-amber-500/60">
              <Star className="size-4" />
              Featured Entities
            </h2>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((entity, i) => {
              const Icon = entityIcons[entity.entityType]
              const label = entityLabels[entity.entityType]
              return (
                <button
                  key={entity.id}
                  onClick={() => navigate(`/investigate?entity=${entity.id}`)}
                  className={`card-glow group relative bg-white/[0.02] border border-white/[0.07] rounded-2xl hover:border-amber-500/25 hover:bg-white/[0.04] active:scale-[0.98] active:bg-white/[0.05] transition-all duration-500 overflow-hidden p-6 text-left animate-fade-up stagger-${i + 1}`}
                >
                  {/* Top accent line */}
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  {/* Entity type badge */}
                  <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.25em] text-amber-500/80 bg-amber-500/[0.07] border border-amber-500/15 rounded-md px-2.5 py-1">
                    <Icon className="size-3" />
                    {label}
                  </span>

                  <div className="mt-4">
                    <h3 className="mb-1.5 font-serif italic text-xl text-slate-100 group-hover:text-amber-400 transition-colors duration-300">
                      {entity.name}
                    </h3>
                    <p className="line-clamp-2 text-sm text-slate-500 leading-relaxed">
                      {entity.description}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-end">
                    <span className="text-[10px] text-amber-500/70 sm:opacity-0 sm:group-hover:opacity-100 sm:translate-x-[-4px] sm:group-hover:translate-x-0 transition-all duration-300 inline-flex items-center gap-1 uppercase tracking-[0.15em] font-semibold">
                      Explore <ArrowRight className="size-3" />
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* Guided Stories */}
      {stories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div className="flex items-center justify-center gap-4 mb-10">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
            <h2 className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.3em] text-amber-500/60">
              <BookOpen className="size-4" />
              Guided Stories
            </h2>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((story, i) => (
              <button
                key={story.id}
                onClick={() => navigate(`/investigate?story=${story.id}`)}
                className={`card-glow group bg-white/[0.02] border border-white/[0.07] rounded-2xl hover:border-amber-500/25 hover:bg-white/[0.04] active:scale-[0.98] active:bg-white/[0.05] transition-all duration-500 overflow-hidden p-6 text-left relative animate-fade-up stagger-${(i % 6) + 1}`}
              >
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <h3 className="mb-2 font-serif italic text-lg text-slate-200 group-hover:text-amber-400 transition-colors duration-300">
                  {story.title}
                </h3>
                <p className="mb-4 line-clamp-3 text-sm text-slate-500 leading-relaxed">
                  {story.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-600 inline-flex items-center gap-1.5 uppercase tracking-[0.15em]">
                    <Footprints className="size-3" />
                    {story.steps.length} step{story.steps.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-[10px] text-amber-500/70 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 inline-flex items-center gap-1 uppercase tracking-[0.15em] font-semibold">
                    Begin <ArrowRight className="size-3" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Footer rule */}
      <footer className="pb-12 flex flex-col items-center gap-3">
        <div className="w-8 h-px bg-amber-700/30" />
        <p className="text-[9px] uppercase tracking-[0.4em] text-slate-700">SPQR</p>
        <p className="max-w-lg px-6 text-center text-[10px] leading-relaxed text-slate-600">
          Built on open data from{' '}
          <a
            href="https://pleiades.stoa.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 underline decoration-slate-700 underline-offset-2 hover:text-amber-500"
          >
            Pleiades
          </a>
          , the Ancient World Mapping Center, ORBIS,{' '}
          <a
            href="https://vici.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 underline decoration-slate-700 underline-offset-2 hover:text-amber-500"
          >
            Vici.org
          </a>{' '}
          and Wikidata —{' '}
          <a
            href="https://github.com/DomDemetz/Ancient-Rome/blob/master/DATA-SOURCES.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 underline decoration-slate-700 underline-offset-2 hover:text-amber-500"
          >
            full credits
          </a>
          .{' '}
          <a
            href="https://github.com/DomDemetz/Ancient-Rome"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 underline decoration-slate-700 underline-offset-2 hover:text-amber-500"
          >
            Open source on GitHub
          </a>
          .
        </p>
      </footer>
    </div>
  )
}
