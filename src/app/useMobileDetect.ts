import { useEffect } from 'react'
import { useUIStore } from '@/stores/useUIStore'

export function useMobileDetect() {
  const setMobile = useUIStore((s) => s.setMobile)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)')
    setMobile(query.matches)
    if (query.matches) toggleSidebar(false)
    function handler(e: MediaQueryListEvent) {
      setMobile(e.matches)
      if (e.matches) toggleSidebar(false)
    }
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }, [setMobile, toggleSidebar])
}
