import type { GrokPlanEventData, GrokPlanProjection, PlanModeState } from './types.ts'

// Keep the official active bit readable even without this plugin installed.
export const GROK_PLAN_EVENT = 'plan/mode'
export const LEGACY_GROK_PLAN_EVENT = 'grok-plan/state'

export type { GrokPlanEventData } from './types.ts'

function isPlanModeState(value: unknown): value is PlanModeState {
  return value === 'Inactive' || value === 'Pending' || value === 'Active' || value === 'ExitPending'
}

export function isGrokPlanEventData(value: unknown): value is GrokPlanEventData {
  if (typeof value !== 'object' || value === null) return false
  if (!('state' in value) || !isPlanModeState(value.state)) return false
  if (!('was_previously_active' in value) || typeof value.was_previously_active !== 'boolean') return false
  if (!('reminder_count' in value) || typeof value.reminder_count !== 'number') return false
  if (!('pending_exit_reminder' in value) || typeof value.pending_exit_reminder !== 'boolean') return false
  if (!('awaiting_plan_approval' in value) || typeof value.awaiting_plan_approval !== 'boolean') return false
  if (!('plan_file_path' in value) || typeof value.plan_file_path !== 'string') return false
  if ('plan_has_content' in value && typeof value.plan_has_content !== 'boolean') return false
  return true
}

export function foldGrokPlan(
  events: readonly { type: string; data: unknown }[],
): GrokPlanEventData | undefined {
  let last: GrokPlanEventData | undefined
  for (const event of events) {
    if ((event.type !== GROK_PLAN_EVENT && event.type !== LEGACY_GROK_PLAN_EVENT)) continue
    if (!isGrokPlanEventData(event.data)) continue
    last = event.data
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
    hasPlan: snapshot?.plan_has_content === true,
    planContent: null,
    planFilePath: snapshot?.plan_file_path ?? '',
    status,
  }
}

export function officialPlanView(view: GrokPlanProjection): { active: boolean; pending: boolean } {
  if (view.state === 'ExitPending') return { active: true, pending: false }
  if (view.state === 'Pending') return { active: false, pending: true }
  return { active: view.active, pending: false }
}

export function hasOpenTurn(events: readonly { type: string }[]): boolean {
  let open = false
  for (const event of events) {
    if (event.type === 'turn/start') open = true
    else if (event.type === 'turn/end') open = false
  }
  return open
}

/** Preserve an old official Plan selection during global replacement.
 * Grok snapshots always win, including an explicit Inactive snapshot. A pending
 * exit is not approval, so an active legacy plan stays constrained until the
 * person exits through the new surface.
 */
export function legacyPlanNeedsMigration(events: readonly { type: string; data: unknown }[]): boolean {
  let active = false
  let wanted = false
  let pending: { id: unknown; wanted: boolean } | undefined
  for (const event of events) {
    if ((event.type === GROK_PLAN_EVENT || event.type === LEGACY_GROK_PLAN_EVENT) && isGrokPlanEventData(event.data)) return false
    if (typeof event.data !== 'object' || event.data === null) continue
    const data = event.data as Record<string, unknown>
    if (event.type === 'plan/mode') { active = data.active === true; wanted = false }
    if (event.type === 'command/run' && data.name === 'plan' && typeof data.args === 'string') {
      pending = { id: data.commandId, wanted: data.args.trim() !== 'off' }
    }
    if (event.type === 'command/done' && pending !== undefined && data.commandId === pending.id) {
      if (data.kind === 'success') wanted = pending.wanted
      pending = undefined
    }
  }
  return active || wanted || pending?.wanted === true
}
