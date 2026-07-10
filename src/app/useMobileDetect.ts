import { useEffect } from 'react'
import { useUIStore } from '@/stores/useUIStore'

export function useMobileDetect() {
  const setMobile = useUIStore((s) => s.setMobile)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)')
    setMobile(query.matches)
    function handler(e: MediaQueryListEvent) {
      setMobile(e.matches)
    }
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }, [setMobile])
}
