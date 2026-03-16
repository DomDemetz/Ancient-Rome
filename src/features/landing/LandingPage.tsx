import { useNavigate } from 'react-router-dom'
import { Compass, ArrowRight, Star, BookOpen, Footprints } from 'lucide-react'
import { entities } from '@/data'
import { stories } from '@/data'
import { entityIcons, entityColors, entityLabels } from '@/lib/colors'

export function LandingPage() {
  const navigate = useNavigate()

  const featured = entities.slice(0, 6)

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Hero Section */}
      <section className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <Compass className="size-12 text-accent-gold/60 mb-6" />
        <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-amber-600">
          The Hidden Network
        </h1>
        <p className="mb-10 max-w-2xl text-lg text-text-secondary md:text-xl">
          Explore the hidden connections of Ancient Rome — from senators and emperors to legions and
          trade routes.
        </p>
        <button
          onClick={() => navigate('/investigate')}
          className="inline-flex items-center gap-2 rounded-lg border border-accent-gold bg-accent-gold/10 px-8 py-3 text-lg font-semibold text-accent-gold transition-colors hover:bg-accent-gold/20 active:scale-95 transition-transform"
        >
          Begin Investigation
          <ArrowRight className="size-5" />
        </button>
      </section>

      {/* Featured Entities */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-text-primary md:text-3xl flex items-center justify-center gap-2">
            <Star className="size-6 text-accent-gold" />
            Featured Entities
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((entity) => {
              const Icon = entityIcons[entity.entityType]
              const color = entityColors[entity.entityType]
              const label = entityLabels[entity.entityType]
              return (
                <button
                  key={entity.id}
                  onClick={() => navigate(`/investigate?entity=${entity.id}`)}
                  className="group relative rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-border bg-bg-card p-5 text-left"
                >
                  {/* Entity type badge overlaid top-left */}
                  <span
                    className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: `${color}22`, color }}
                  >
                    <Icon className="size-3" />
                    {label}
                  </span>

                  <div className="mt-7">
                    <h3 className="mb-1 text-lg font-bold text-text-primary group-hover:text-accent-gold transition-colors">
                      {entity.name}
                    </h3>
                    <p className="line-clamp-2 text-sm text-text-secondary">{entity.description}</p>
                  </div>

                  {/* Bottom: type pill + investigate link */}
                  <div className="mt-3 flex items-center justify-between">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: `${color}22`, color }}
                    >
                      {label}
                    </span>
                    <span className="text-xs text-accent-gold opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1">
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
          <h2 className="mb-8 text-center text-2xl font-bold text-text-primary md:text-3xl flex items-center justify-center gap-2">
            <BookOpen className="size-6 text-accent-gold" />
            Guided Stories
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((story) => (
              <button
                key={story.id}
                onClick={() => navigate(`/investigate?story=${story.id}`)}
                className="group rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-border bg-bg-card p-5 text-left"
              >
                <h3 className="mb-2 text-lg font-bold text-accent-gold group-hover:text-amber-400 transition-colors">
                  {story.title}
                </h3>
                <p className="mb-3 line-clamp-3 text-sm text-text-secondary">{story.description}</p>
                <span className="text-xs text-text-secondary inline-flex items-center gap-1">
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
