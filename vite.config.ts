import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this at /resomap-t0-v3/, not at /. Change the repo name
  // and this has to change with it, or every asset 404s and the page is blank.
  base: '/resomap-t0-v3/',
  plugins: [react(), tailwindcss()],
  build: {
    // Three chunks that change at different rates, so a copy edit does not make
    // a returning visitor re-download React and Leaflet. The screens themselves
    // are split further by the lazy() calls in App.tsx.
    rollupOptions: {
      output: {
        // The function form, not the object form: this build runs on Rolldown,
        // which only accepts a function here. Leaflet is tested first because
        // `react-leaflet` contains the string "react" and would otherwise be
        // filed under the React chunk, splitting the map across two files.
        // Both separators are matched — the ids arrive with backslashes on
        // Windows and forward slashes in CI, and a rule that only works on one
        // of them silently stops chunking on the other.
        manualChunks(id: string) {
          if (/node_modules[/\\](react-)?leaflet/.test(id)) return 'leaflet'
          if (/node_modules[/\\](react|react-dom|scheduler)[/\\]/.test(id)) return 'react'
          return undefined
        },
      },
    },
  },
})
