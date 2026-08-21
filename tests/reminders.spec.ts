import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  planModeEditRejected,
  planModeExitReminder,
  planModeReentryReminder,
  planModeReminderFull,
  planModeReminderSparse,
  wrapSystemReminder,
} from '../src/reminders.ts'

describe('reminders', () => {
  it('renders the full reminder with an existing plan', () => {
    const text = planModeReminderFull({
      planPath: '/tmp/session/plan.md',
      planHasContent: true,
      tools: { edit: 'search_replace', ask_user: 'ask_user_question', exit_plan: 'exit_plan_mode' },
    })
    assert.match(text, /A plan file exists at \/tmp\/session\/plan.md/)
    assert.match(text, /search_replace tool/)
    assert.match(text, /Plan mode is active/)
    assert.match(text, /## Plan File:/)
    assert.match(text, /only file you are allowed to edit/)
    assert.equal(text.includes('No plan written yet'), false)
  })

  it('renders the full reminder without a plan', () => {
    const text = planModeReminderFull({
      planPath: '/tmp/session/plan.md',
      planHasContent: false,
      tools: { edit: 'search_replace' },
    })
    assert.match(text, /No plan written yet/)
    assert.match(text, /\/tmp\/session\/plan.md/)
    assert.equal(text.includes('A plan file exists at'), false)
  })

  it('resolves custom tool names and has no subagent or phase workflow', () => {
    const text = planModeReminderFull({
      planPath: '/tmp/plan.md',
      planHasContent: true,
      tools: { edit: 'EditFile', ask_user: 'AskUser', exit_plan: 'FinishPlan' },
    })
    assert.match(text, /EditFile tool/)
    assert.match(text, /AskUser to clarify requirements/)
    assert.match(text, /FinishPlan to present your plan to the user/)
    assert.equal(text.includes('search_replace'), false)
    assert.equal(text.includes('subagent_type'), false)
    assert.equal(text.includes('Phase 1:'), false)
    assert.equal(text.includes('Plan Workflow'), false)
  })

  it('keeps the sparse reminder static', () => {
    assert.equal(
      planModeReminderSparse(),
      'Plan mode is still active. Do not make any edits or writes to the system except for the plan file.',
    )
  })

  it('renders reentry and exit reminders', () => {
    const reentry = planModeReentryReminder({
      planPath: '/tmp/plan.md',
      tools: { ask_user: 'ask_user_question', exit_plan: 'exit_plan_mode' },
    })
    assert.match(reentry, /Returning to Plan Mode/)
    assert.match(reentry, /\/tmp\/plan.md/)
    assert.equal(
      planModeExitReminder(),
      'You have exited plan mode. You can now make edits, run tools, and take actions.',
    )
    assert.equal(planModeExitReminder().includes('/implement'), false)
  })

  it('renders the edit rejection', () => {
    assert.equal(
      planModeEditRejected('/tmp/session/plan.md'),
      'Rejected: file edits are not allowed in plan mode - the only editable file is the plan file (/tmp/session/plan.md).',
    )
  })

  it('wraps reminders the way Grok does', () => {
    assert.equal(wrapSystemReminder('hello'), '<system-reminder>\nhello\n</system-reminder>')
  })
})
