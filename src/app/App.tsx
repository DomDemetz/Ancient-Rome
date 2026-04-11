import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './Layout'
import { LandingPage } from '@/features/landing/LandingPage'
import { InvestigationBoard } from '@/features/board/InvestigationBoard'
import { useUIStore } from '@/stores/useUIStore'

export function App() {
  const atlasMode = useUIStore((s) => s.atlasMode)

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={atlasMode ? <InvestigationBoard /> : <LandingPage />} />
        <Route path="/investigate" element={<InvestigationBoard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
