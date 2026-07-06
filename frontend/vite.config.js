import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base matches the GitHub Pages project path
export default defineConfig({
  base: '/ChainChat/',
  plugins: [react()],
})
