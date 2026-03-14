import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      {children}
      <Analytics />
    </BrowserRouter>
  )
}
