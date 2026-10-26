import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// ─── Build-time guard for VITE_API_URL ────────────────────────────────────────
// The API URL is baked into the bundle when `vite build` runs. A missing or
// malformed value ships a site that can never log in:
//   * missing            -> falls back to http://localhost:5000 (the user's own
//                            machine) -> "Network error. Please check your connection."
//   * no trailing /api   -> POST /auth/login instead of /api/auth/login
//                            -> 404 {"message":"Route not found"}
//   * trailing slash     -> /api//auth/login (double slash)
//                            -> 404 {"message":"Route not found"}
// So a production build fails loudly instead of deploying broken.
const API_URL_PATTERN = /^https?:\/\/[^/]+(\/[\w.-]+)*\/api\/?$/

export default defineConfig(({ mode }) => {
  // The Vercel dashboard variable lives in process.env; the .env files are read
  // by loadEnv. Check both so either source satisfies the guard.
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const rawApiUrl = (process.env.VITE_API_URL || fileEnv.VITE_API_URL || '').trim()

  if (mode === 'production') {
    if (!rawApiUrl) {
      throw new Error(
        'VITE_API_URL is not set. Define it in the Vercel project environment ' +
          'variables (e.g. https://staff-portal-tool.onrender.com/api) or in ' +
          'frontend/.env.production before running a production build.'
      )
    }
    if (!API_URL_PATTERN.test(rawApiUrl)) {
      throw new Error(
        `VITE_API_URL must be an absolute http(s) URL ending in /api ` +
          `(a trailing slash is allowed) — got "${rawApiUrl}".`
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
