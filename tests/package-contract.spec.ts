import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (name: string) => readFileSync(join(root, name), 'utf8')

describe('stock dsh plugin add contract', () => {
  const pkg = JSON.parse(read('package.json')) as {
    main?: string
    exports?: { '.'?: string; './client'?: string }
    files?: string[]
    scripts?: Record<string, string>
    dsh?: { bundle?: { patch?: string }; client?: { entry?: string } }
  }

  it('declares dsh.bundle.patch so add joins the profile layer stack', () => {
    assert.equal(pkg.dsh?.bundle?.patch, './cordis.yml')
    assert.match(read('cordis.yml'), /name:\s*dsh-grok-plan-mode/)
  })

  it('points the Host at committed JS, not TypeScript source', () => {
    assert.equal(pkg.main, 'lib/index.js')
    assert.equal(pkg.exports?.['.'], './lib/index.js')
    assert.equal(pkg.exports?.['./client'], './lib/client.js')
    assert.equal(pkg.dsh?.client?.entry, './lib/client.js')
    assert.equal(pkg.scripts?.prepare, undefined)
    assert.ok(pkg.files?.includes('lib/index.js'))
    assert.ok(pkg.files?.includes('lib/client.js'))
    assert.ok(pkg.files?.includes('cordis.yml'))
  })

  it('ships a loadable Host entry with named apply / name / inject', () => {
    const host = read('lib/index.js')
    assert.match(host, /\bexport\b[\s\S]*\bapply\b/)
    assert.match(host, /\bexport\b[\s\S]*\bname\b/)
    assert.match(host, /\bexport\b[\s\S]*\binject\b/)
    assert.match(host, /\[dsh-grok-plan-mode\] loaded/)
    assert.doesNotMatch(host, /from ['"]\.\/.*\.ts['"]/)
  })

  it('ships the prebuilt web client', () => {
    const client = read('lib/client.js')
    assert.match(client, /dsh-grok-plan-mode/)
    assert.match(client, /__ModuleLoader__/)
  })

  it('leads both READMEs with the official one-liner', () => {
    for (const name of ['README.md', 'README.en.md']) {
      const text = read(name)
      const lead = text.slice(0, 600)
      assert.match(lead, /dsh plugin --profile web add github:aa2246740\/dsh-grok-plan-mode/)
      assert.match(lead, /pnpm/)
      assert.doesNotMatch(lead, /dshx|my-plugins|DSHX/i)
    }
  })
})
