import { resolve } from 'node:path'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

const harness = process.env.DSHX_HARNESS ?? process.cwd()

export default defineConfig({
  root: harness,
  plugins: [tsconfigPaths({ projects: [resolve(harness, 'tsconfig.base.json')] })],
  test: {
    include: ['my-plugins/dsh-grok-plan-mode/tests/live-dsh.spec.ts'],
    pool: 'forks',
    fileParallelism: false,
  },
})
