import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    open: false,
  },
})
