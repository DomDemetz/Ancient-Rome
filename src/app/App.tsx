import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './Layout'
import { LandingPage } from '@/features/landing/LandingPage'
import { InvestigationBoard } from '@/features/board/InvestigationBoard'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/investigate" element={<InvestigationBoard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
