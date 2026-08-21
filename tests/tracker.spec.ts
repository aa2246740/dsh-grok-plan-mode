import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isMarkdownFilePath, isPlanFileWrite, PlanModeTracker } from '../src/tracker.ts'

function tracker(): PlanModeTracker {
  return new PlanModeTracker('/tmp/test-session')
}

describe('PlanModeTracker', () => {
  it('user-initiated lifecycle', () => {
    const t = tracker()
    assert.equal(t.getState(), 'Inactive')
    assert.equal(t.enterPending(), true)
    assert.equal(t.getState(), 'Pending')
    assert.equal(t.activate(), true)
    assert.equal(t.getState(), 'Active')
    assert.equal(t.deactivateApproved(), true)
    assert.equal(t.getState(), 'Inactive')
  })

  it('user exit while turn in flight', () => {
    const t = tracker()
    t.enterPending()
    t.activate()
    t.userExit(true)
    assert.equal(t.getState(), 'ExitPending')
    t.completeDeferredExit()
    assert.equal(t.getState(), 'Inactive')
    assert.equal(t.hasPendingExitReminder(), true)
  })

  it('pending cancel is clean', () => {
    const t = tracker()
    t.enterPending()
    t.userExit(false)
    assert.equal(t.getState(), 'Inactive')
    assert.equal(t.hasPendingExitReminder(), false)
  })

  it('agent-initiated skips pending', () => {
    const t = tracker()
    assert.equal(t.activateFromTool(), true)
    assert.equal(t.getState(), 'Active')
  })

  it('detects reentry', () => {
    const t = tracker()
    t.enterPending()
    t.activate()
    t.deactivateApproved()
    t.enterPending()
    assert.equal(t.isReentry(), true)
  })

  it('alternates full and sparse reminders', () => {
    const t = tracker()
    t.enterPending()
    t.activate()
    assert.equal(t.shouldUseFullReminder(), true)
    t.recordReminderInjected()
    assert.equal(t.shouldUseFullReminder(), false)
    t.recordReminderInjected()
    assert.equal(t.shouldUseFullReminder(), true)
  })

  it('puts the plan file in the session dir by default', () => {
    const t = new PlanModeTracker('/home/user/.dsh/sessions/proj/abc-123')
    assert.equal(t.planFilePath(), '/home/user/.dsh/sessions/proj/abc-123/plan.md')
  })

  it('accepts a workspace plan path and still auto-approves the session alias', () => {
    const sessionPlan = '/home/user/.dsh/sessions/proj/abc-123/plan.md'
    const workspacePlan = '/workspace/.dsh/plans/abc-123/plan.md'
    const t = new PlanModeTracker('/home/user/.dsh/sessions/proj/abc-123', workspacePlan, [sessionPlan])
    t.activateFromTool()
    assert.equal(t.planFilePath(), workspacePlan)
    assert.equal(t.shouldAutoApproveEdit(workspacePlan), true)
    assert.equal(t.shouldAutoApproveEdit(sessionPlan), true)
    assert.equal(t.shouldAutoApproveEdit('/workspace/hello.txt'), false)
  })

  it('compaction resets to the full reminder', () => {
    const t = tracker()
    t.enterPending()
    t.activate()
    t.recordReminderInjected()
    t.resetAfterCompaction()
    assert.equal(t.shouldUseFullReminder(), true)
  })

  it('mid-turn activation buffers and delivers once', () => {
    const t = tracker()
    t.enterPending()
    assert.equal(t.activateMidTurn('reminder text'), true)
    assert.equal(t.getState(), 'Active')
    assert.equal(t.hasPendingActivation(), true)
    assert.equal(t.takePendingActivation(), 'reminder text')
    assert.equal(t.hasPendingActivation(), false)
    t.recordReminderInjected()
    assert.equal(t.shouldUseFullReminder(), false)
    assert.equal(t.takePendingActivation(), undefined)
  })

  it('user exit withdraws an undelivered activation', () => {
    const t = tracker()
    t.enterPending()
    t.activateMidTurn('reminder text')
    t.userExit(true)
    assert.equal(t.getState(), 'Inactive')
    assert.equal(t.hasPendingActivation(), false)
    assert.equal(t.hasPendingExitReminder(), false)
    t.enterPending()
    assert.equal(t.isReentry(), false)
  })

  it('user exit after delivery defers normally', () => {
    const t = tracker()
    t.enterPending()
    t.activateMidTurn('reminder text')
    t.takePendingActivation()
    t.recordReminderInjected()
    t.userExit(true)
    assert.equal(t.getState(), 'ExitPending')
  })

  it('snapshot pending collapses to inactive', () => {
    const t = tracker()
    t.enterPending()
    const restored = PlanModeTracker.fromSnapshot('/tmp/test-session', t.snapshot())
    assert.equal(restored.getState(), 'Inactive')
  })

  it('snapshot ExitPending collapses to inactive with reminder', () => {
    const t = tracker()
    t.enterPending()
    t.activate()
    t.userExit(true)
    const restored = PlanModeTracker.fromSnapshot('/tmp/test-session', t.snapshot())
    assert.equal(restored.getState(), 'Inactive')
    assert.equal(restored.hasPendingExitReminder(), true)
  })

  it('snapshot Active restores awaiting approval', () => {
    const t = tracker()
    t.enterPending()
    t.activate()
    t.setAwaitingPlanApproval(true)
    const restored = PlanModeTracker.fromSnapshot('/tmp/test-session', t.snapshot())
    assert.equal(restored.getState(), 'Active')
    assert.equal(restored.isAwaitingPlanApproval(), true)
  })

  it('legacy snapshot without awaiting defaults false', () => {
    const restored = PlanModeTracker.fromSnapshot('/tmp/test-session', {
      state: 'Active',
      was_previously_active: true,
      reminder_count: 0,
      pending_exit_reminder: false,
      awaiting_plan_approval: false,
    })
    assert.equal(restored.isAwaitingPlanApproval(), false)
  })

  it('reenter from ExitPending cancels deferred exit', () => {
    const t = tracker()
    t.enterPending()
    t.activate()
    t.userExit(true)
    assert.equal(t.enterPending(), true)
    assert.equal(t.getState(), 'Active')
    assert.equal(t.hasPendingExitReminder(), false)
    t.completeDeferredExit()
    assert.equal(t.getState(), 'Active')
  })

  it('deactivate approved does not arm an exit reminder', () => {
    const t = tracker()
    t.enterPending()
    t.activate()
    t.deactivateApproved()
    assert.equal(t.hasPendingExitReminder(), false)
  })

  it('auto-approves only the plan file while Active', () => {
    const t = tracker()
    t.enterPending()
    t.activate()
    assert.equal(t.shouldAutoApproveEdit(t.planFilePath()), true)
    assert.equal(t.shouldAutoApproveEdit('/some/other/file.rs'), false)
    const idle = tracker()
    assert.equal(idle.shouldAutoApproveEdit(idle.planFilePath()), false)
  })
})

describe('path helpers', () => {
  it('matches the plan file exactly', () => {
    const plan = '/home/user/.dsh/sessions/proj/abc/plan.md'
    assert.equal(isPlanFileWrite(plan, plan), true)
    assert.equal(isPlanFileWrite('/home/user/project/src/main.rs', plan), false)
  })

  it('recognizes markdown suffixes the way Grok does', () => {
    assert.equal(isMarkdownFilePath('/x/plan.md'), true)
    assert.equal(isMarkdownFilePath('notes.MDX'), true)
    assert.equal(isMarkdownFilePath('readme.markdown'), true)
    assert.equal(isMarkdownFilePath('/a/guide.mdown'), true)
    assert.equal(isMarkdownFilePath('x.mkd'), true)
    assert.equal(isMarkdownFilePath('x.MKDN'), true)
    assert.equal(isMarkdownFilePath('/src/lib.rs'), false)
    assert.equal(isMarkdownFilePath('/no-extension'), false)
    assert.equal(isMarkdownFilePath('企业AI决策清单.html'), false)
    assert.equal(isMarkdownFilePath('企业AI决策清单.md'), true)
    assert.equal(isMarkdownFilePath('计划.markdown'), true)
    assert.equal(isMarkdownFilePath('md'), false)
  })
})
