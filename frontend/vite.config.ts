import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { seoPlugin } from './build/seoPlugin.ts'

function normalizeBasePath(input?: string): string {
  const value = input && input.trim().length > 0 ? input.trim() : '/'
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`

  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

const basePath = normalizeBasePath(process.env.VITE_BASE_PATH)
const backendDevOrigin = process.env.DEV_BACKEND_ORIGIN || 'http://127.0.0.1:8000'
const websocketProxyPath = basePath === '/' ? '/ws' : `${basePath.slice(0, -1)}/ws`

// Shared by the dev server and `vite preview` (used for production-build E2E runs), so
// requests to the Django backend work the same way regardless of which one serves the SPA.
const backendProxy = {
  '/admin': { target: backendDevOrigin, changeOrigin: true },
  '/api': { target: backendDevOrigin, changeOrigin: true },
  '/static': { target: backendDevOrigin, changeOrigin: true },
  '/media': { target: backendDevOrigin, changeOrigin: true },
  [websocketProxyPath]: { target: backendDevOrigin, ws: true, changeOrigin: true },
}

function manualChunks(id: string): string | undefined {
  if (!id.includes('/node_modules/')) {
    return undefined
  }

  if (
    id.includes('/node_modules/react/') ||
    id.includes('/node_modules/react-dom/') ||
    id.includes('/node_modules/react-router/')
  ) {
    return 'react'
  }

  if (id.includes('/node_modules/@mui/icons-material/')) {
    return 'muiIcons'
  }

  if (id.includes('/node_modules/@mui/material/')) {
    return 'mui'
  }

  if (
    id.includes('/node_modules/i18next/') ||
    id.includes('/node_modules/react-i18next/')
  ) {
    return 'i18n'
  }

  return undefined
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
      '@': path.resolve(import.meta.dirname, './src'),
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
    testTimeout: 15000,
    hookTimeout: 15000,
    teardownTimeout: 5000,
    pool: process.env.CI ? 'forks' : 'threads',
    // Run test files in parallel everywhere, CI included. This used to be
    // disabled under CI, which serialized all ~240 files onto one worker and
    // was the single biggest contributor to the job's runtime (392s -> 240s
    // locally on 4 cores when re-enabled, with an unchanged 2405-test result).
    // The pool size is left at Vitest's default, which already derives from the
    // machine's available parallelism; each fork carries a full jsdom + MUI
    // module graph, so raising it past that costs more in memory than it wins.
    fileParallelism: true,
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
        manualChunks,
      },
    },
  },
})
