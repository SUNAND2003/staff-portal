import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// ─── Build-time guard for VITE_API_URL / VITE_API_BASE_URL ────────────────────
// Verifies that a valid backend URL is configured before creating production bundles.
const HTTP_URL_PATTERN = /^https?:\/\/[^/\s]+(\/.*)?$/

export default defineConfig(({ mode }) => {
  // Read from process.env (Vercel dashboard) or loaded .env files
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const rawApiUrl = (
    process.env.VITE_API_URL ||
    process.env.VITE_API_BASE_URL ||
    fileEnv.VITE_API_URL ||
    fileEnv.VITE_API_BASE_URL ||
    ''
  ).trim()

  if (mode === 'production') {
    if (!rawApiUrl) {
      throw new Error(
        'VITE_API_URL (or VITE_API_BASE_URL) is not set. Define it in the Vercel project environment ' +
          'variables (e.g. https://staff-portal-tool.onrender.com/api) or in ' +
          'frontend/.env.production before running a production build.'
      )
    }
    if (!HTTP_URL_PATTERN.test(rawApiUrl)) {
      throw new Error(
        `VITE_API_URL must be a valid http(s) URL — got "${rawApiUrl}".`
      )
    }
  }

  return {
    plugins: [react()],
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
