import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    minify: false,
    target: 'esnext'
  },
  server: {
    proxy: {
      '/api/rpc': {
        target: 'https://studio.genlayer.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/rpc/, '/api')
      }
    }
  }
})
