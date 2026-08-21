import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  adoptLegacyPlanFile,
  dshHome,
  fallbackPlanPath,
  planFileHasContent,
  probeOrCreateEmptyPlanFile,
  resolvePlanFilePath,
  workspacePlanFilePath,
} from '../src/plan-file.ts'

describe('plan file paths', () => {
  it('puts the writable plan under the workspace so Workspace Write can persist it', () => {
    const resolved = resolvePlanFilePath({
      sessionId: 'abc-123',
      cwd: '/workspace/my-project',
      home: '/home/user/.dsh',
    })
    assert.equal(resolved.planFilePath, '/workspace/my-project/.dsh/plans/abc-123/plan.md')
    assert.equal(
      resolved.sessionPlanPath,
      `/home/user/.dsh/sessions/${encodeURIComponent('/workspace/my-project')}/abc-123/plan.md`,
    )
    assert.equal(fallbackPlanPath('/workspace/my-project'), '/workspace/my-project/.dsh/plan.md')
    assert.equal(
      workspacePlanFilePath('/workspace/my-project', 'abc-123'),
      '/workspace/my-project/.dsh/plans/abc-123/plan.md',
    )
  })

  it('falls back to the session dir when there is no cwd', () => {
    const resolved = resolvePlanFilePath({
      sessionId: 'abc-123',
      home: '/home/user/.dsh',
    })
    assert.equal(resolved.planFilePath, '/home/user/.dsh/sessions/_no_cwd/abc-123/plan.md')
    assert.equal(resolved.sessionPlanPath, resolved.planFilePath)
  })

  it('reads DSH_HOME', () => {
    assert.equal(dshHome({ DSH_HOME: '/custom/dsh' }), '/custom/dsh')
  })
})

describe('probeOrCreateEmptyPlanFile', () => {
  it('creates parents and an empty file on not-found', async () => {
    const root = await mkdtemp(join(tmpdir(), 'grok-plan-'))
    const path = join(root, 'nested', 'dir', 'plan.md')
    try {
      const status = await probeOrCreateEmptyPlanFile(path)
      assert.deepEqual(status, { kind: 'empty' })
      assert.equal(await readFile(path, 'utf8'), '')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('never truncates a nonempty plan', async () => {
    const root = await mkdtemp(join(tmpdir(), 'grok-plan-'))
    const path = join(root, 'plan.md')
    try {
      await writeFile(path, '# prior plan\n')
      const status = await probeOrCreateEmptyPlanFile(path)
      assert.deepEqual(status, { kind: 'non_empty' })
      assert.equal(await readFile(path, 'utf8'), '# prior plan\n')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reports empty without rewriting', async () => {
    const root = await mkdtemp(join(tmpdir(), 'grok-plan-'))
    const path = join(root, 'plan.md')
    try {
      await writeFile(path, '')
      const status = await probeOrCreateEmptyPlanFile(path)
      assert.deepEqual(status, { kind: 'empty' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not write over a directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'grok-plan-'))
    const path = join(root, 'plan.md')
    try {
      await mkdir(path)
      const status = await probeOrCreateEmptyPlanFile(path)
      assert.deepEqual(status, { kind: 'missing', reason: 'not_a_file' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('treats empty seed as no content for reminders', async () => {
    const root = await mkdtemp(join(tmpdir(), 'grok-plan-'))
    const path = join(root, 'plan.md')
    try {
      await writeFile(path, '')
      assert.equal(await planFileHasContent(path), false)
      await writeFile(path, '# x\n')
      assert.equal(await planFileHasContent(path), true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('adoptLegacyPlanFile', () => {
  it('copies a leftover session plan into the workspace path once', async () => {
    const root = await mkdtemp(join(tmpdir(), 'grok-plan-'))
    const from = join(root, 'session', 'plan.md')
    const to = join(root, 'workspace', '.dsh', 'plans', 'abc', 'plan.md')
    try {
      await mkdir(join(root, 'session'), { recursive: true })
      await writeFile(from, '# leftover\n')
      await adoptLegacyPlanFile(from, to)
      assert.equal(await readFile(to, 'utf8'), '# leftover\n')
      await writeFile(from, '# newer leftover\n')
      await adoptLegacyPlanFile(from, to)
      assert.equal(await readFile(to, 'utf8'), '# leftover\n')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
