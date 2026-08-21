/**
 * Grok Build Plan Mode for DeepSeek Harness.
 *
 * Full port of xai-org/grok-build plan mode onto published DSH plugin seams.
 * This package does not patch DSH source.
 */

import type { Context } from '@deepseek-ai/cordis'
import { applyGrokPlanMode } from './host/plugin.ts'

export const name = 'grok-plan-mode'
export const inject = ['tools', 'systemPrompt', 'commands', 'sessionProjections']

export function apply(ctx: Context): void {
  console.log('[dsh-grok-plan-mode] loaded')
  applyGrokPlanMode(ctx)
}

export { PlanModeTracker } from './tracker.ts'
export { planModeEditGate, classifyToolAccess } from './gate.ts'
export {
  planModeReminderFull,
  planModeReminderSparse,
  planModeReentryReminder,
  planModeExitReminder,
  planModeEditRejected,
} from './reminders.ts'
