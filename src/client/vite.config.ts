import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const rootEnv = dotenv.config({ path: path.resolve(__dirname, '../../.env') }).parsed || {}
  const env = loadEnv(mode, process.cwd(), '')

  const auth0Domain = env.VITE_AUTH0_DOMAIN || process.env.VITE_AUTH0_DOMAIN || rootEnv.AUTH0_DOMAIN || 'dev-th8tt10rhx8zng8d.us.auth0.com'
  const auth0ClientId = env.VITE_AUTH0_CLIENT_ID || process.env.VITE_AUTH0_CLIENT_ID || rootEnv.AUTH0_CLIENT_ID || 'nHrQDhxUsSWE7DbkYdNX74rVVhs2VAeL'
  const auth0Audience = env.VITE_AUTH0_AUDIENCE || process.env.VITE_AUTH0_AUDIENCE || rootEnv.IDP_AUDIENCE || 'https://mindcare-api'
  const backendUrl = env.VITE_BACKEND_URL || process.env.VITE_BACKEND_URL || ''
  const wsUrl = env.VITE_WS_URL || process.env.VITE_WS_URL || ''

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_AUTH0_DOMAIN': JSON.stringify(auth0Domain),
      'import.meta.env.VITE_AUTH0_CLIENT_ID': JSON.stringify(auth0ClientId),
      'import.meta.env.VITE_AUTH0_AUDIENCE': JSON.stringify(auth0Audience),
      'import.meta.env.VITE_BACKEND_URL': JSON.stringify(backendUrl),
      'import.meta.env.VITE_WS_URL': JSON.stringify(wsUrl)
    },
    server: {
      proxy: {
        '/auth': 'http://localhost:3000'
      }
    }
  }
})

