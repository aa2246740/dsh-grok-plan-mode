import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { foldGrokPlan, GROK_PLAN_EVENT, officialPlanView, viewFromSnapshot } from '../src/fold.ts'

describe('foldGrokPlan', () => {
  it('uses the last snapshot', () => {
    const folded = foldGrokPlan([
      {
        type: GROK_PLAN_EVENT,
        data: {
          state: 'Pending',
          was_previously_active: false,
          reminder_count: 0,
          pending_exit_reminder: false,
          awaiting_plan_approval: false,
          plan_file_path: '/tmp/a/plan.md',
        },
      },
      {
        type: GROK_PLAN_EVENT,
        data: {
          state: 'Active',
          was_previously_active: true,
          reminder_count: 1,
          pending_exit_reminder: false,
          awaiting_plan_approval: true,
          plan_file_path: '/tmp/a/plan.md',
        },
      },
    ])
    assert.equal(folded?.state, 'Active')
    assert.equal(folded?.awaiting_plan_approval, true)
    const view = viewFromSnapshot(folded)
    assert.equal(view.status, 'plan approval')
    assert.deepEqual(officialPlanView(view), { active: true, pending: false })
  })

  it('maps Pending to the official entering chip', () => {
    const view = viewFromSnapshot({
      state: 'Pending',
      was_previously_active: false,
      reminder_count: 0,
      pending_exit_reminder: false,
      awaiting_plan_approval: false,
      plan_file_path: '/tmp/plan.md',
    })
    assert.equal(view.status, 'plan')
    assert.deepEqual(officialPlanView(view), { active: false, pending: true })
  })
})
