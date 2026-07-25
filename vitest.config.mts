import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/** Unit tests import app modules by their '@/…' path, the same way the app does. */
export default defineConfig({
  resolve: {
    alias: { '@': path.dirname(fileURLToPath(import.meta.url)) },
  },
})
