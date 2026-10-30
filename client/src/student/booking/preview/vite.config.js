import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// An independent preview build keeps the shared app entry and config untouched.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('../../../../dist/booking-preview', import.meta.url)),
    emptyOutDir: true,
  },
})
