import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ENTERED_PLAN_MODE_MESSAGE,
  formatEnterPlanMode,
  formatExitPlanReady,
} from '../src/prompts.ts'

describe('enter_plan_mode prompt', () => {
  it('includes the exploration message and write steps', () => {
    const prompt = formatEnterPlanMode({
      planFilePath: '/tmp/session/plan.md',
      planFileSeed: { kind: 'empty' },
    })
    assert.match(prompt, /entered plan mode/)
    assert.match(prompt, /exploring the codebase/)
    assert.match(prompt, /implementation plan/)
    assert.match(prompt, /The file exists and is empty/)
    assert.match(prompt, /5\. Write your plan to the plan file above/)
    assert.match(prompt, /6\. When ready, use exit_plan_mode to present your plan to the user/)
    assert.equal(prompt.includes('create it at that path first if needed'), false)
  })

  it('reports nonempty and unavailable seeds', () => {
    assert.match(
      formatEnterPlanMode({
        planFilePath: '/tmp/plan.md',
        planFileSeed: { kind: 'non_empty' },
      }),
      /The file exists but is not empty/,
    )
    assert.match(
      formatEnterPlanMode({
        planFilePath: '.dsh/plan.md',
        planFileSeed: { kind: 'missing', reason: 'unavailable' },
      }),
      /The plan file location is unavailable/,
    )
  })

  it('resolves tool hints and optional task guidance', () => {
    const prompt = formatEnterPlanMode({
      planFilePath: '/tmp/plan.md',
      planFileSeed: { kind: 'empty' },
      toolHints: { ask_user: 'AskUser', exit_plan: 'FinishPlan', task: 'delegate' },
    })
    assert.match(prompt, /Use AskUser/)
    assert.match(prompt, /use FinishPlan/)
    assert.match(prompt, /delegate tool with subagent_type="explore"/)
    assert.equal(formatEnterPlanMode({
      message: ENTERED_PLAN_MODE_MESSAGE,
      planFilePath: '/tmp/plan.md',
      planFileSeed: { kind: 'empty' },
    }).includes('subagent_type'), false)
  })
})

describe('exit_plan_mode prompt', () => {
  it('includes saved path and plan body', () => {
    const prompt = formatExitPlanReady({
      planFilePath: '/tmp/.dsh/plan.md',
      planContent: 'Step 1\nStep 2',
    })
    assert.match(prompt, /plan has been approved/)
    assert.match(prompt, /saved at:/)
    assert.match(prompt, /Step 1/)
    assert.match(prompt, /## Plan:/)
  })
})
