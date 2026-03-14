import { BrowserRouter } from 'react-router-dom'

export function Providers({ children }: { children: React.ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>
}
