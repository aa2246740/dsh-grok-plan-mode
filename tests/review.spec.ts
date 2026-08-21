import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  displayPlanContent,
  formatFeedback,
  normalizePlanContent,
  resumeActionFor,
  revisePlanMessage,
} from '../src/review.ts'
import { EMPTY_PLAN_PLACEHOLDER, outcomeFromLabel, planApprovalStatusLabel } from '../src/types.ts'

describe('review outcomes', () => {
  it('maps known labels and fails closed', () => {
    assert.equal(outcomeFromLabel('Approve'), 'approved')
    assert.equal(outcomeFromLabel('Quit'), 'abandoned')
    assert.equal(outcomeFromLabel('Request changes'), 'cancelled')
    assert.equal(outcomeFromLabel('approve'), 'cancelled')
    assert.equal(outcomeFromLabel(''), 'cancelled')
  })

  it('maps resume actions', () => {
    assert.deepEqual(resumeActionFor('approved'), { kind: 'leave_and_implement' })
    assert.deepEqual(resumeActionFor('abandoned', 'ignored'), { kind: 'leave_only' })
    const revise = resumeActionFor('cancelled', 'tweak it')
    assert.equal(revise.kind, 'stay_and_revise')
    if (revise.kind === 'stay_and_revise') assert.match(revise.message, /tweak it/)
  })

  it('revise message asks when feedback is empty', () => {
    assert.match(revisePlanMessage(''), /Ask the user what changes/)
    assert.match(revisePlanMessage('   '), /Ask the user what changes/)
    assert.match(revisePlanMessage('use async'), /The user said:/)
  })
})

describe('plan preview', () => {
  it('treats whitespace as empty and still has a placeholder', () => {
    assert.equal(normalizePlanContent('   \n\n  '), undefined)
    assert.equal(displayPlanContent(undefined), EMPTY_PLAN_PLACEHOLDER)
    assert.equal(EMPTY_PLAN_PLACEHOLDER.trim() === '', false)
    assert.equal(planApprovalStatusLabel(true), 'Waiting on plan approval')
    assert.equal(planApprovalStatusLabel(false), 'No plan written — approve or request changes')
  })
})

describe('feedback formatting', () => {
  it('quotes selected line snippets for inline comments', () => {
    const feedback = formatFeedback({
      planContent: 'alpha\nbravo\ncharlie\ndelta',
      comments: [
        { id: 0, lineStart: 2, lineEnd: 3, text: 'rewrite this' },
        { id: 1, lineStart: 3, lineEnd: 5, text: 'combine these' },
      ],
      freeform: 'overall note',
    })
    assert.equal(
      feedback,
      'Proposed plan line 2:\n> bravo\n\nComment:\nrewrite this\n\nProposed plan lines 3-4:\n> charlie\n> delta\n\nComment:\ncombine these\n\nAdditional feedback:\noverall note',
    )
  })

  it('handles out-of-range lines', () => {
    assert.equal(
      formatFeedback({
        planContent: 'alpha',
        comments: [{ id: 0, lineStart: 9, lineEnd: 10, text: 'where is this' }],
      }),
      'Proposed plan line 9:\n> [selected lines unavailable]\n\nComment:\nwhere is this',
    )
  })

  it('keeps plan.md references for file-backed comments', () => {
    assert.equal(
      formatFeedback({
        source: 'file_backed',
        planContent: 'alpha\nbravo',
        comments: [{ id: 0, lineStart: 1, lineEnd: 3, text: 'keep file ref' }],
        freeform: 'freeform',
      }),
      '@plan.md:1-2\nkeep file ref\n\nfreeform',
    )
  })
})
