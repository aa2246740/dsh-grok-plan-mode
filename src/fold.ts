import type { GrokPlanProjection, PlanModeSnapshot } from './types.ts'

export const GROK_PLAN_EVENT = 'grok-plan/state'

export interface GrokPlanEventData extends PlanModeSnapshot {
  plan_file_path: string
}

export function emptySnapshot(): PlanModeSnapshot {
  return {
    state: 'Inactive',
    was_previously_active: false,
    reminder_count: 0,
    pending_exit_reminder: false,
    awaiting_plan_approval: false,
  }
}

export function foldGrokPlan(
  events: readonly { type: string; data: unknown }[],
): GrokPlanEventData | undefined {
  let last: GrokPlanEventData | undefined
  for (const event of events) {
    if (event.type !== GROK_PLAN_EVENT) continue
    last = event.data as GrokPlanEventData
  }
  return last
}

export function viewFromSnapshot(snapshot: GrokPlanEventData | undefined): GrokPlanProjection {
  const state = snapshot?.state ?? 'Inactive'
  const awaiting = snapshot?.awaiting_plan_approval ?? false
  const active = state === 'Active'
  const pending = state === 'Pending' || state === 'ExitPending'
  let status: GrokPlanProjection['status'] = 'off'
  if (awaiting) status = 'plan approval'
  else if (state !== 'Inactive') status = 'plan'
  return {
    state,
    active,
    pending,
    awaitingApproval: awaiting,
    hasPlan: false,
    planContent: null,
    planFilePath: snapshot?.plan_file_path ?? '',
    status,
  }
}

export function officialPlanView(view: GrokPlanProjection): { active: boolean; pending: boolean } {
  if (view.state === 'ExitPending') return { active: true, pending: false }
  if (view.state === 'Pending') return { active: false, pending: true }
  return { active: view.active, pending: view.pending }
}

export function hasOpenTurn(events: readonly { type: string }[]): boolean {
  let open = false
  for (const event of events) {
    if (event.type === 'turn/start') open = true
    else if (event.type === 'turn/end') open = false
  }
  return open
}
