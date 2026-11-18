import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// ─── Build-time guard for VITE_API_URL / VITE_API_BASE_URL ────────────────────
const DEFAULT_PRODUCTION_API = 'https://hexa-staff-portal-backend.onrender.com/api'
const HTTP_URL_PATTERN = /^https?:\/\/[^/\s]+(\/.*)?$/

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig(({ mode }) => {
  // Read from process.env (Vercel dashboard) or loaded .env files (check cwd and config dir)
  const fileEnvCwd = loadEnv(mode, process.cwd(), '')
  const fileEnvDir = loadEnv(mode, __dirname, '')
  const rawApiUrl = (
    process.env.VITE_API_URL ||
    process.env.VITE_API_BASE_URL ||
    fileEnvDir.VITE_API_URL ||
    fileEnvDir.VITE_API_BASE_URL ||
    fileEnvCwd.VITE_API_URL ||
    fileEnvCwd.VITE_API_BASE_URL ||
    DEFAULT_PRODUCTION_API
  ).trim()

  if (mode === 'production' && !HTTP_URL_PATTERN.test(rawApiUrl)) {
    console.warn(`[vite.config.js] Invalid API URL "${rawApiUrl}", falling back to ${DEFAULT_PRODUCTION_API}`)
  }

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(rawApiUrl || DEFAULT_PRODUCTION_API),
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  }
})
