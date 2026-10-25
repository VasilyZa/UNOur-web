import { svelte } from '@sveltejs/vite-plugin-svelte'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [svelte()],
  // Integration files share a real server with four password-hashing slots.
  test: { setupFiles: ['./test/backend.ts'], maxWorkers: 2 },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target:
          loadEnv(mode, process.cwd(), '').API_PROXY_TARGET ||
          'http://127.0.0.1:8088',
        changeOrigin: true,
      },
    },
  },
}))
