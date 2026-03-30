import { Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-100 noise-overlay">
      <Outlet />
    </div>
  )
}
