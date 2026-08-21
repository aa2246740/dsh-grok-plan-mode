import { isPlanFileWrite } from './tracker.ts'
import type { PlanModeTracker } from './tracker.ts'

export type PlanEditGate = 'allow' | 'reject_non_plan_file'

export type AccessKind =
  | { kind: 'edit'; path: string }
  | { kind: 'apply_patch' }
  | { kind: 'other' }

export const DSH_EDIT_TOOLS = new Set([
  'write',
  'edit',
  'str_replace_editor',
  'apply_patch',
])

/**
 * Grok's `plan_mode_edit_gate`.
 *
 * Active plan mode rejects every edit that is not the session plan file,
 * including under auto / always-approve. Bash, reads, MCP, and the plan
 * tools themselves are not gated here.
 */
export function planModeEditGate(tracker: PlanModeTracker, access: AccessKind): PlanEditGate {
  if (!tracker.isActive()) return 'allow'
  if (access.kind === 'apply_patch') return 'reject_non_plan_file'
  if (access.kind === 'edit' && !tracker.shouldAutoApproveEdit(access.path)) {
    return 'reject_non_plan_file'
  }
  return 'allow'
}

export function classifyToolAccess(input: {
  name: string
  arguments: unknown
}): AccessKind {
  if (input.name === 'apply_patch') return { kind: 'apply_patch' }
  if (!DSH_EDIT_TOOLS.has(input.name)) return { kind: 'other' }
  if (input.name === 'str_replace_editor' && isViewCommand(input.arguments)) {
    return { kind: 'other' }
  }
  const path = extractEditPath(input.arguments)
  if (path === undefined) return { kind: 'apply_patch' }
  return { kind: 'edit', path }
}

export function isViewCommand(args: unknown): boolean {
  return isRecord(args) && args.command === 'view'
}

export function extractEditPath(args: unknown): string | undefined {
  if (!isRecord(args)) return undefined
  for (const key of ['path', 'file_path', 'filePath']) {
    const value = args[key]
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return undefined
}

export function resolveEditPath(target: string, cwd: string | undefined): string {
  if (isAbsolutePath(target) || cwd === undefined || cwd.trim() === '') return target
  const base = cwd.endsWith('/') ? cwd.slice(0, -1) : cwd
  const rel = target.startsWith('./') ? target.slice(2) : target
  return `${base}/${rel}`
}

export function isPlanningAgent(meta: {
  origin?: string
  delegationDepth?: number
}): boolean {
  if (meta.origin === 'subagent') return false
  if ((meta.delegationDepth ?? 0) > 0) return false
  return true
}

export function pathsEqual(left: string, right: string): boolean {
  return isPlanFileWrite(left, right)
}

function isAbsolutePath(value: string): boolean {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
