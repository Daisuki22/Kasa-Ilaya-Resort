import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

const isProduction = process.env.NODE_ENV === 'production'
const isVercel = process.env.VERCEL === '1'
const basePath = process.env.VITE_BASE_PATH || (isProduction && !isVercel ? '/Kasa-Ilaya-Resort/dist/' : '/')

export default defineConfig({
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost/Kasa-Ilaya-Resort',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [react()],
  base: basePath,
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
});
