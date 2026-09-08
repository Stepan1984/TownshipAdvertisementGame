import { defineConfig } from 'vite'

export default defineConfig({
  // Repo name — required for https://Stepan1984.github.io/TownshipAdvertisementGame/
  base: '/TownshipAdvertisementGame/',
  root: '.',
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    open: false,
  },
})
