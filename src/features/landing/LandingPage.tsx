import { useNavigate } from 'react-router-dom'
import { entities } from '@/data'
import { stories } from '@/data'

const entityTypeColors: Record<string, string> = {
  person: 'bg-entity-person',
  organization: 'bg-entity-organization',
  event: 'bg-entity-event',
  location: 'bg-entity-location',
  document: 'bg-entity-document',
  legion: 'bg-entity-legion',
  dynasty: 'bg-entity-dynasty',
  religion: 'bg-entity-religion',
  'trade-good': 'bg-entity-trade-good',
  infrastructure: 'bg-entity-infrastructure',
}

export function LandingPage() {
  const navigate = useNavigate()

  const featured = entities.slice(0, 6)

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Hero Section */}
      <section className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-accent-gold md:text-6xl">
          The Hidden Network
        </h1>
        <p className="mb-10 max-w-2xl text-lg text-text-secondary md:text-xl">
          Explore the hidden connections of Ancient Rome — from senators and emperors to legions and
          trade routes.
        </p>
        <button
          onClick={() => navigate('/investigate')}
          className="rounded-lg border border-accent-gold bg-accent-gold/10 px-8 py-3 text-lg font-semibold text-accent-gold transition-colors hover:bg-accent-gold/20"
        >
          Begin Investigation
        </button>
      </section>

      {/* Featured Entities */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-text-primary md:text-3xl">
            Featured Entities
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((entity) => (
              <button
                key={entity.id}
                onClick={() => navigate(`/investigate?entity=${entity.id}`)}
                className="rounded-lg border border-border bg-bg-card p-5 text-left transition-colors hover:border-accent-gold/50"
              >
                <span
                  className={`mb-2 inline-block rounded px-2 py-0.5 text-xs font-semibold text-white ${entityTypeColors[entity.entityType] ?? 'bg-gray-600'}`}
                >
                  {entity.entityType}
                </span>
                <h3 className="mb-1 text-lg font-semibold text-text-primary">{entity.name}</h3>
                <p className="line-clamp-2 text-sm text-text-secondary">{entity.description}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Guided Stories */}
      {stories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <h2 className="mb-8 text-center text-2xl font-bold text-text-primary md:text-3xl">
            Guided Stories
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((story) => (
              <button
                key={story.id}
                onClick={() => navigate(`/investigate?story=${story.id}`)}
                className="rounded-lg border border-border bg-bg-card p-5 text-left transition-colors hover:border-accent-gold/50"
              >
                <h3 className="mb-2 text-lg font-semibold text-accent-gold">{story.title}</h3>
                <p className="mb-3 line-clamp-3 text-sm text-text-secondary">{story.description}</p>
                <span className="text-xs text-text-secondary">
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
