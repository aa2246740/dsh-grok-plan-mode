import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  classifyToolAccess,
  isPlanningAgent,
  planModeEditGate,
  resolveEditPath,
} from '../src/gate.ts'
import { PlanModeTracker } from '../src/tracker.ts'

function active(): PlanModeTracker {
  const t = new PlanModeTracker('/tmp/gate-session')
  t.enterPending()
  t.activate()
  return t
}

describe('planModeEditGate', () => {
  it('rejects grok-class edits outside the plan file', () => {
    const t = active()
    assert.equal(planModeEditGate(t, { kind: 'edit', path: '/tmp/src/main.rs' }), 'reject_non_plan_file')
    assert.equal(
      planModeEditGate(t, { kind: 'edit', path: '/tmp/README.md' }),
      'reject_non_plan_file',
    )
  })

  it('allows the session plan file', () => {
    const t = active()
    assert.equal(planModeEditGate(t, { kind: 'edit', path: '/tmp/gate-session/plan.md' }), 'allow')
  })

  it('always rejects apply_patch while Active', () => {
    const t = active()
    assert.equal(planModeEditGate(t, { kind: 'apply_patch' }), 'reject_non_plan_file')
  })

  it('does not gate bash or other non-edit tools', () => {
    const t = active()
    assert.equal(planModeEditGate(t, { kind: 'other' }), 'allow')
  })

  it('gates nothing while Inactive or Pending', () => {
    const idle = new PlanModeTracker('/tmp/gate-session')
    assert.equal(planModeEditGate(idle, { kind: 'edit', path: '/tmp/src/main.rs' }), 'allow')
    const pending = new PlanModeTracker('/tmp/gate-session')
    pending.enterPending()
    assert.equal(planModeEditGate(pending, { kind: 'edit', path: '/tmp/src/main.rs' }), 'allow')
  })
})

describe('classifyToolAccess', () => {
  it('treats DSH write/edit tools as edits', () => {
    assert.deepEqual(
      classifyToolAccess({ name: 'write', arguments: { file_path: '/tmp/a.ts' } }),
      { kind: 'edit', path: '/tmp/a.ts' },
    )
    assert.deepEqual(
      classifyToolAccess({ name: 'edit', arguments: { file_path: '/tmp/a.ts' } }),
      { kind: 'edit', path: '/tmp/a.ts' },
    )
    assert.deepEqual(
      classifyToolAccess({
        name: 'str_replace_editor',
        arguments: { command: 'str_replace', path: '/tmp/a.ts' },
      }),
      { kind: 'edit', path: '/tmp/a.ts' },
    )
  })

  it('does not gate str_replace_editor view', () => {
    assert.deepEqual(
      classifyToolAccess({
        name: 'str_replace_editor',
        arguments: { command: 'view', path: '/tmp/a.ts' },
      }),
      { kind: 'other' },
    )
  })

  it('does not gate bash even when the command writes', () => {
    assert.deepEqual(
      classifyToolAccess({ name: 'bash', arguments: { command: 'echo hi > /tmp/f' } }),
      { kind: 'other' },
    )
  })
})

describe('planning-agent scope', () => {
  it('does not apply the parent gate to subagents', () => {
    assert.equal(isPlanningAgent({}), true)
    assert.equal(isPlanningAgent({ origin: 'subagent' }), false)
    assert.equal(isPlanningAgent({ delegationDepth: 1 }), false)
  })
})

describe('resolveEditPath', () => {
  it('resolves relative paths against cwd', () => {
    assert.equal(resolveEditPath('src/a.ts', '/repo'), '/repo/src/a.ts')
    assert.equal(resolveEditPath('/abs/a.ts', '/repo'), '/abs/a.ts')
  })
})
