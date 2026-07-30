import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { seoPlugin } from './build/seoPlugin'

function normalizeBasePath(input?: string): string {
  const value = input && input.trim().length > 0 ? input.trim() : '/'
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`

  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

const basePath = normalizeBasePath(process.env.VITE_BASE_PATH)
const backendDevOrigin = process.env.DEV_BACKEND_ORIGIN || 'http://127.0.0.1:8000'

// Shared by the dev server and `vite preview` (used for production-build E2E runs), so
// requests to the Django backend work the same way regardless of which one serves the SPA.
const backendProxy = {
  '/admin': { target: backendDevOrigin, changeOrigin: true },
  '/api': { target: backendDevOrigin, changeOrigin: true },
  '/static': { target: backendDevOrigin, changeOrigin: true },
  '/media': { target: backendDevOrigin, changeOrigin: true },
}

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
  plugins: [react(), seoPlugin(process.env)],
  optimizeDeps: {
    include: ['tiptap-markdown'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    watch: {
      ignored: [
        '**/coverage/**',
        '**/dist/**',
        '**/.git/**',
        '**/node_modules/.cache/**',
      ],
    },
    proxy: backendProxy,
  },
  preview: {
    proxy: backendProxy,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    pool: process.env.CI ? 'forks' : 'threads',
    fileParallelism: !process.env.CI,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'build/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    server: {
      deps: {
        inline: ['@mui/x-data-grid', '@mui/material'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'src/__tests__/**',
        'src/test-utils/**',
        'src/setupTests.ts',
        '**/*.test.{ts,tsx}',
        '**/*.config.{ts,js}',
        '**/types.ts',
      ],
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          mui: ['@mui/material'],
          muiIcons: ['@mui/icons-material'],
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
  },
})
