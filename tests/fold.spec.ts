import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { legacyPlanNeedsMigration, foldGrokPlan, GROK_PLAN_EVENT, isGrokPlanEventData, officialPlanView, viewFromSnapshot } from '../src/fold.ts'

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
    assert.equal(view.hasPlan, false)
    assert.deepEqual(officialPlanView(view), { active: false, pending: true })
  })

  it('surfaces plan_has_content on the chip view', () => {
    const view = viewFromSnapshot({
      state: 'Active',
      was_previously_active: true,
      reminder_count: 1,
      pending_exit_reminder: false,
      awaiting_plan_approval: false,
      plan_file_path: '/tmp/plan.md',
      plan_has_content: true,
    })
    assert.equal(view.hasPlan, true)
  })

  it('ignores malformed grok-plan events', () => {
    assert.equal(isGrokPlanEventData({ state: 'Active' }), false)
    const folded = foldGrokPlan([
      { type: GROK_PLAN_EVENT, data: { state: 'Active' } },
      {
        type: GROK_PLAN_EVENT,
        data: {
          state: 'Inactive',
          was_previously_active: true,
          reminder_count: 2,
          pending_exit_reminder: false,
          awaiting_plan_approval: false,
          plan_file_path: '/tmp/plan.md',
        },
      },
    ])
    assert.equal(folded?.state, 'Inactive')
    assert.equal(folded?.was_previously_active, true)
  })
})


describe('global replacement migration', () => {
  it('preserves active legacy plans and does not invent approval', () => {
    assert.equal(legacyPlanNeedsMigration([{type:'plan/mode',data:{active:true}}]),true)
    assert.equal(legacyPlanNeedsMigration([{type:'plan/mode',data:{active:false}}]),false)
    assert.equal(legacyPlanNeedsMigration([{type:'plan/mode',data:{active:true}}, {type:'command/run',data:{name:'plan',args:'off',commandId:'a'}}]),true)
  })
  it('preserves a pending entry and ignores failed commands', () => {
    const start={type:'command/run',data:{name:'plan',args:'',commandId:'a'}}
    assert.equal(legacyPlanNeedsMigration([start]),true)
    assert.equal(legacyPlanNeedsMigration([start,{type:'command/done',data:{commandId:'a',kind:'success'}}]),true)
    assert.equal(legacyPlanNeedsMigration([start,{type:'command/done',data:{commandId:'a',kind:'error'}}]),false)
  })
  it('does not reactivate an already migrated and exited Grok plan', () => {
    assert.equal(legacyPlanNeedsMigration([{type:'plan/mode',data:{active:true}}, {type:GROK_PLAN_EVENT,data:{state:'Inactive',was_previously_active:true,reminder_count:0,pending_exit_reminder:false,awaiting_plan_approval:false,plan_file_path:'/tmp/plan.md'}}]),false)
  })
})
