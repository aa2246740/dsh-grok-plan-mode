import { build } from 'tsdown'

/** Self-contained Host entry for stock `dsh plugin add`. Does not use DSHX. */
await build({
  config: false,
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  dts: false,
  sourcemap: false,
  clean: false,
  fixedExtension: false,
  deps: { neverBundle: true },
})
