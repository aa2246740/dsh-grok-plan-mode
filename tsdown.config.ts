import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const candidates = [
  process.env.DSHX_HARNESS ? resolve(process.env.DSHX_HARNESS, 'tools/dshx/src/client-build.js') : '',
  resolve(here, '../../tools/dshx/src/client-build.js'),
  resolve(process.cwd(), '../../tools/dshx/src/client-build.js'),
  resolve(process.cwd(), 'tools/dshx/src/client-build.js'),
].filter(Boolean)

const clientBuild = candidates.find(path => existsSync(path))
if (clientBuild === undefined) {
  throw new Error(`dshx client-build.js not found. Copy this repo to <harness>/my-plugins/dsh-grok-plan-mode or set DSHX_HARNESS. Looked in:\n${candidates.join('\n')}`)
}

const { externalClientBundle } = await import(pathToFileURL(clientBuild).href)

export default externalClientBundle('dsh-grok-plan-mode', ['lib/types/index.js'], {
  clientEntry: 'src/client/index.tsx',
})
