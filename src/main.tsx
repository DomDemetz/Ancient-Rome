import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Providers } from './app/providers'
import { App } from './app/App'
import './index.css'

// A tab that outlives a deploy holds an index.html whose hashed chunk names
// no longer exist on Pages — every lazy layer toggle then 404s ("Failed to
// load shipwrecks layer"). On the first such failure, reload once to pick up
// the current build; the flag stops a reload loop if the failure is real.
window.addEventListener('vite:preloadError', (event) => {
  // One auto-reload per minute — a second failure right after reloading
  // means the outage is real; fall through to the layer-error toast.
  const last = Number(sessionStorage.getItem('chunk-reload-at') ?? 0)
  if (Date.now() - last < 60_000) return
  sessionStorage.setItem('chunk-reload-at', String(Date.now()))
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)
