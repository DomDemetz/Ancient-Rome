import { useNavigate } from 'react-router-dom'
import { Compass, ArrowRight, Star, BookOpen, Footprints } from 'lucide-react'
import { entities } from '@/data'
import { stories } from '@/data'
import { entityIcons, entityLabels } from '@/lib/colors'

export function LandingPage() {
  const navigate = useNavigate()

  const featured = entities.slice(0, 6)

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      {/* Hero Section */}
      <section className="relative flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        {/* Ambient spotlight */}
        <div className="absolute w-[400px] h-[200px] bg-[radial-gradient(ellipse,rgba(245,158,11,0.08),transparent_70%)] pointer-events-none" />

        <Compass className="size-12 text-amber-500/60 mb-6" />
        <h1 className="mb-6 font-serif italic text-5xl md:text-7xl tracking-tight bg-gradient-to-r from-amber-400 via-amber-500 to-orange-600 bg-clip-text text-transparent">
          The Hidden Network
        </h1>
        <p className="mb-10 max-w-2xl text-lg text-slate-400 md:text-xl">
          Explore the hidden connections of Ancient Rome — from senators and emperors to legions and
          trade routes.
        </p>
        <button
          onClick={() => navigate('/investigate')}
          className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl px-8 py-4 text-xs font-bold uppercase tracking-[0.3em] shadow-[0_8px_30px_rgba(180,83,9,0.35)] active:scale-[0.97] transition-all"
        >
          Begin Investigation
          <ArrowRight className="size-5" />
        </button>
      </section>

      {/* Featured Entities */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <h2 className="mb-8 text-center font-serif italic text-2xl md:text-3xl text-slate-100 flex items-center justify-center gap-2">
            <Star className="size-6 text-amber-500" />
            Featured Entities
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((entity) => {
              const Icon = entityIcons[entity.entityType]
              const label = entityLabels[entity.entityType]
              return (
                <button
                  key={entity.id}
                  onClick={() => navigate(`/investigate?entity=${entity.id}`)}
                  className="group relative bg-white/[0.03] border border-white/[0.05] rounded-2xl hover:border-amber-500/20 transition-all duration-300 overflow-hidden p-6 text-left"
                >
                  {/* Entity type badge overlaid top-left */}
                  <span className="absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-1">
                    <Icon className="size-3" />
                    {label}
                  </span>

                  <div className="mt-8">
                    <h3 className="mb-1 font-serif italic text-xl text-slate-100 group-hover:text-amber-500 transition-colors">
                      {entity.name}
                    </h3>
                    <p className="line-clamp-2 text-sm text-slate-500">{entity.description}</p>
                  </div>

                  {/* Bottom: investigate link */}
                  <div className="mt-4 flex items-center justify-end">
                    <span className="text-xs text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1">
                      Investigate <ArrowRight className="size-3" />
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
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <h2 className="mb-8 text-center font-serif italic text-2xl md:text-3xl text-slate-100 flex items-center justify-center gap-2">
            <BookOpen className="size-6 text-amber-500" />
            Guided Stories
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((story) => (
              <button
                key={story.id}
                onClick={() => navigate(`/investigate?story=${story.id}`)}
                className="group bg-white/[0.03] border border-white/[0.05] rounded-2xl hover:border-amber-500/20 transition-all duration-300 overflow-hidden p-6 text-left"
              >
                <h3 className="mb-2 font-serif italic text-xl text-slate-100 group-hover:text-amber-500 transition-colors">
                  {story.title}
                </h3>
                <p className="mb-3 line-clamp-3 text-sm text-slate-500">{story.description}</p>
                <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                  <Footprints className="size-3" />
                  {story.steps.length} step{story.steps.length !== 1 ? 's' : ''}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
