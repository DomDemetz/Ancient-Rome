import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Served from https://domdemetz.github.io/Ancient-Rome/ in production,
// but from / during local dev. BASE_URL is read by the router (see providers.tsx).
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Ancient-Rome/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
}))
