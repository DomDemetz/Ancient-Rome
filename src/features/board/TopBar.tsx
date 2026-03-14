import { LensSwitcher } from './LensSwitcher'

export function TopBar() {
  return (
    <header className="flex h-12 items-center justify-between border-b border-border px-4 shrink-0">
      <span className="text-lg font-bold text-accent-gold">Ancient Rome</span>
      <LensSwitcher />
    </header>
  )
}
