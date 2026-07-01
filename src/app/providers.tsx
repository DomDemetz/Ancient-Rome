import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      {children}
      <Analytics />
    </BrowserRouter>
  )
}
