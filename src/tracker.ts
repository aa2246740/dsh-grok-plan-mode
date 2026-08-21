import type { PlanModeSnapshot, PlanModeState } from './types.ts'

export interface PendingActivation {
  text: string
  priorWasPreviouslyActive: boolean
}

/**
 * Pure port of Grok Build `PlanModeTracker`.
 *
 * Inactive → Pending → Active → ExitPending
 * Transient Pending / ExitPending collapse on resume.
 */
export class PlanModeTracker {
  private state: PlanModeState
  private wasPreviouslyActive: boolean
  private reminderCount: number
  private pendingExitReminder: boolean
  private awaitingPlanApproval: boolean
  private pendingActivation: PendingActivation | undefined
  private readonly planFilePathValue: string

  constructor(sessionDir: string) {
    this.state = 'Inactive'
    this.wasPreviouslyActive = false
    this.reminderCount = 0
    this.pendingExitReminder = false
    this.awaitingPlanApproval = false
    this.pendingActivation = undefined
    this.planFilePathValue = joinPlanFile(sessionDir)
  }

  static fromSnapshot(sessionDir: string, snapshot: PlanModeSnapshot): PlanModeTracker {
    const next = { ...snapshot }
    if (next.state === 'Pending') {
      next.state = 'Inactive'
    } else if (next.state === 'ExitPending') {
      next.state = 'Inactive'
      next.pending_exit_reminder = true
    }
    const tracker = new PlanModeTracker(sessionDir)
    tracker.state = next.state
    tracker.wasPreviouslyActive = next.was_previously_active
    tracker.reminderCount = next.reminder_count
    tracker.pendingExitReminder = next.pending_exit_reminder
    tracker.awaitingPlanApproval = next.awaiting_plan_approval
    return tracker
  }

  snapshot(): PlanModeSnapshot {
    return {
      state: this.state,
      was_previously_active: this.wasPreviouslyActive,
      reminder_count: this.reminderCount,
      pending_exit_reminder: this.pendingExitReminder,
      awaiting_plan_approval: this.awaitingPlanApproval,
    }
  }

  getState(): PlanModeState {
    return this.state
  }

  isActive(): boolean {
    return this.state === 'Active'
  }

  planFilePath(): string {
    return this.planFilePathValue
  }

  setAwaitingPlanApproval(awaiting: boolean): void {
    this.awaitingPlanApproval = awaiting
  }

  isAwaitingPlanApproval(): boolean {
    return this.awaitingPlanApproval
  }

  shouldAutoApproveEdit(editPath: string): boolean {
    return this.isActive() && isPlanFileWrite(editPath, this.planFilePathValue)
  }

  shouldUseFullReminder(): boolean {
    return this.reminderCount % 2 === 0
  }

  hasPendingExitReminder(): boolean {
    return this.pendingExitReminder
  }

  isReentry(): boolean {
    return this.wasPreviouslyActive && this.state === 'Pending'
  }

  hasPendingActivation(): boolean {
    return this.pendingActivation !== undefined
  }

  enterPending(): boolean {
    if (this.state === 'Inactive') {
      this.state = 'Pending'
      this.pendingExitReminder = false
      return true
    }
    if (this.state === 'ExitPending') {
      this.state = 'Active'
      this.pendingExitReminder = false
      return true
    }
    return false
  }

  activate(): boolean {
    if (this.state !== 'Pending') return false
    this.state = 'Active'
    this.wasPreviouslyActive = true
    this.reminderCount = 0
    return true
  }

  activateMidTurn(renderedReminder: string): boolean {
    if (this.state !== 'Pending') return false
    const priorWasPreviouslyActive = this.wasPreviouslyActive
    this.state = 'Active'
    this.wasPreviouslyActive = true
    this.reminderCount = 0
    this.pendingActivation = {
      text: renderedReminder,
      priorWasPreviouslyActive,
    }
    return true
  }

  takePendingActivation(): string | undefined {
    const pending = this.pendingActivation
    this.pendingActivation = undefined
    return pending?.text
  }

  activateFromTool(): boolean {
    if (this.state !== 'Inactive') return false
    this.state = 'Active'
    this.wasPreviouslyActive = true
    this.reminderCount = 0
    this.pendingExitReminder = false
    return true
  }

  deactivateApproved(): boolean {
    if (this.state !== 'Active') return false
    this.state = 'Inactive'
    this.reminderCount = 0
    this.awaitingPlanApproval = false
    this.pendingActivation = undefined
    return true
  }

  userExit(turnInFlight: boolean): void {
    this.awaitingPlanApproval = false
    if (this.pendingActivation !== undefined && this.state === 'Active') {
      this.state = 'Inactive'
      this.wasPreviouslyActive = this.pendingActivation.priorWasPreviouslyActive
      this.pendingActivation = undefined
      return
    }
    if (this.state === 'Pending') {
      this.state = 'Inactive'
      return
    }
    if (this.state === 'Active') {
      if (turnInFlight) this.state = 'ExitPending'
      else {
        this.state = 'Inactive'
        this.pendingExitReminder = true
      }
    }
  }

  completeDeferredExit(): void {
    if (this.state !== 'ExitPending') return
    this.state = 'Inactive'
    this.pendingExitReminder = true
  }

  queueExitReminder(): void {
    this.pendingExitReminder = true
  }

  recordReminderInjected(): void {
    this.reminderCount += 1
  }

  clearPendingExitReminder(): void {
    this.pendingExitReminder = false
  }

  resetAfterCompaction(): void {
    if (this.state === 'Active') {
      this.reminderCount = 0
      this.pendingActivation = undefined
    }
  }
}

export function joinPlanFile(sessionDir: string): string {
  if (sessionDir.endsWith('/') || sessionDir.endsWith('\\')) return `${sessionDir}plan.md`
  return `${sessionDir}/plan.md`
}

export function isPlanFileWrite(targetPath: string, planFile: string): boolean {
  return normalizePath(targetPath) === normalizePath(planFile)
}

/** Grok compares absolute paths for equality. Normalize separators only. */
export function normalizePath(value: string): string {
  return value.replace(/\\/g, '/')
}

const MARKDOWN_SUFFIXES = ['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdx']

export function isMarkdownFilePath(path: string): boolean {
  const name = path.split(/[/\\]/).pop()
  if (name === undefined) return false
  const lower = name.toLowerCase()
  return MARKDOWN_SUFFIXES.some(suffix => lower.endsWith(suffix) && lower.length >= suffix.length)
}
