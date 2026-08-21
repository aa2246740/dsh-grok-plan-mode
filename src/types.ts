/** Shared Plan Mode types. Names match Grok Build's persisted snapshot. */

export type PlanModeState = 'Inactive' | 'Pending' | 'Active' | 'ExitPending'

export type PlanApprovalOutcome = 'approved' | 'cancelled' | 'abandoned'

export type PlanFileSeedFailure =
  | 'not_created'
  | 'not_a_file'
  | 'inaccessible'
  | 'unavailable'

export type PlanFileSeedStatus =
  | { kind: 'empty' }
  | { kind: 'non_empty' }
  | { kind: 'missing'; reason: PlanFileSeedFailure }

export interface PlanModeSnapshot {
  state: PlanModeState
  was_previously_active: boolean
  reminder_count: number
  pending_exit_reminder: boolean
  awaiting_plan_approval: boolean
}

export interface EnterPlanModeToolHints {
  ask_user: string
  exit_plan: string
  task: string
}

export interface PlanComment {
  id: number
  /** 1-based inclusive start, exclusive end (Grok `Range<usize>`). */
  lineStart: number
  lineEnd: number
  text: string
}

export interface GrokPlanProjection {
  state: PlanModeState
  active: boolean
  pending: boolean
  awaitingApproval: boolean
  hasPlan: boolean
  planContent: string | null
  planFilePath: string
  status: 'off' | 'plan' | 'plan approval'
}

export const REVIEW_QUESTION_ID = 'grok-plan-review'
export const APPROVE_LABEL = 'Approve'
export const REQUEST_CHANGES_LABEL = 'Request changes'
export const QUIT_LABEL = 'Quit'

export const EMPTY_PLAN_PLACEHOLDER = `\
# No plan written yet

The agent exited plan mode without writing a plan.

- **Approve** — leave plan mode and start implementing
- **Request changes** — send the agent back to planning
- **Quit** — abandon and turn plan mode off
`

export const PLAN_APPROVED_IMPLEMENT_MESSAGE =
  'The user approved the plan. Implement the plan in plan.md.'

export const ENTER_PLAN_MODE = 'enter_plan_mode'
export const EXIT_PLAN_MODE = 'exit_plan_mode'

export const DEFAULT_TOOL_HINTS: EnterPlanModeToolHints = {
  ask_user: 'ask_user_question',
  exit_plan: EXIT_PLAN_MODE,
  task: '',
}

export function officialPlanProjection(view: GrokPlanProjection): { active: boolean; pending: boolean } {
  return { active: view.active, pending: view.pending }
}

export function planApprovalStatusLabel(hasPlan: boolean): string {
  return hasPlan
    ? 'Waiting on plan approval'
    : 'No plan written — approve or request changes'
}

export function outcomeFromLabel(label: string): PlanApprovalOutcome {
  if (label === APPROVE_LABEL) return 'approved'
  if (label === QUIT_LABEL) return 'abandoned'
  return 'cancelled'
}
