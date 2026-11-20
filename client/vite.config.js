import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  envPrefix: ['VITE_', 'USE_MOCK_DATA'],
  plugins: [react()],
})
