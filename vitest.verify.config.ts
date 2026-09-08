import { defineConfig } from 'vitest/config'

// Installed public DSH packages, not a second Web Host or a copied plugin.
export default defineConfig({
  test: {
    include: ['tests/live-dsh.spec.ts'],
    pool: 'forks',
    fileParallelism: false,
  },
})
