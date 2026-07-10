import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './Layout'
import { InvestigationBoard } from '@/features/board/InvestigationBoard'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<InvestigationBoard />} />
        {/* legacy links from the pre-atlas era */}
        <Route path="/investigate" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
