import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // agent worktrees carry full repo copies — never run their tests here
    exclude: ['**/node_modules/**', '**/.claude/worktrees/**'],
  },
  resolve: {
    alias: { '@': '/src' },
  },
})
