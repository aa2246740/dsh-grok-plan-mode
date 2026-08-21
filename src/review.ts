import type { PlanApprovalOutcome, PlanComment } from './types.ts'
import { EMPTY_PLAN_PLACEHOLDER } from './types.ts'

export type PlanReviewSource = 'inline' | 'file_backed'

export function normalizePlanContent(planContent: string | null | undefined): string | undefined {
  if (planContent === undefined || planContent === null) return undefined
  return planContent.trim() === '' ? undefined : planContent
}

export function displayPlanContent(planContent: string | null | undefined): string {
  return normalizePlanContent(planContent) ?? EMPTY_PLAN_PLACEHOLDER
}

export function revisePlanMessage(feedback: string): string {
  const trimmed = feedback.trim()
  if (trimmed === '') {
    return 'The user wants to revise the plan. Ask the user what changes they would like to make.'
  }
  return `The user wants to revise the plan. The user said:\n${trimmed}`
}

export function abandonedPlanMessage(): string {
  return 'The user abandoned the plan and turned plan mode off. Stop here and wait for their next message.'
}

export function inlinePlanSnippets(planContent: string | undefined, lineStart: number, lineEnd: number): string {
  if (planContent === undefined) return '> [plan content unavailable]'
  const lines = planContent.split('\n')
  if (lineStart === 0 || lineStart >= lineEnd || lineStart > lines.length) {
    return '> [selected lines unavailable]'
  }
  const end = Math.min(lineEnd - 1, lines.length)
  if (end < lineStart) return '> [selected lines unavailable]'
  return lines.slice(lineStart - 1, end).map(line => `> ${line}`).join('\n')
}

export function formatFileBackedPlanComment(comment: PlanComment): string {
  const range = comment.lineEnd - comment.lineStart === 1
    ? `@plan.md:${comment.lineStart}`
    : `@plan.md:${comment.lineStart}-${comment.lineEnd - 1}`
  return `${range}\n${comment.text}`
}

export function formatFeedback(input: {
  comments: readonly PlanComment[]
  planContent?: string
  source?: PlanReviewSource
  freeform?: string
}): string {
  const source = input.source ?? 'inline'
  const parts = input.comments.map(comment => {
    if (source === 'file_backed') return formatFileBackedPlanComment(comment)
    const label = comment.lineEnd - comment.lineStart === 1
      ? `Proposed plan line ${comment.lineStart}:`
      : `Proposed plan lines ${comment.lineStart}-${comment.lineEnd - 1}:`
    const snippets = inlinePlanSnippets(input.planContent, comment.lineStart, comment.lineEnd)
    return `${label}\n${snippets}\n\nComment:\n${comment.text}`
  })
  const freeform = input.freeform?.trim() ?? ''
  if (freeform !== '') {
    const text = source === 'inline' && input.comments.length > 0
      ? `Additional feedback:\n${freeform}`
      : freeform
    parts.push(text)
  }
  return parts.join('\n\n')
}

export function resumeActionFor(
  outcome: PlanApprovalOutcome,
  feedback?: string,
): { kind: 'leave_and_implement' } | { kind: 'stay_and_revise'; message: string } | { kind: 'leave_only' } {
  if (outcome === 'approved') return { kind: 'leave_and_implement' }
  if (outcome === 'abandoned') return { kind: 'leave_only' }
  return { kind: 'stay_and_revise', message: revisePlanMessage(feedback ?? '') }
}
