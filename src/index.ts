/**
 * Grok Build Plan Mode for DeepSeek Harness 0.1.2-rc.1.
 *
 * File-backed plan.md, a hard edit gate, and a three-way review.
 * This package does not patch DSH source.
 */

import type { Context } from '@deepseek-ai/cordis'
import { installPlanReplacement } from './host/replacement.ts'
import { applyGrokPlanMode } from './host/plugin.ts'

export const name = 'grok-plan-mode'
export const inject = ['tools', 'commands', 'sessionProjections']

export async function apply(ctx: Context): Promise<void> {
  ctx.logger.info('[dsh-grok-plan-mode] loaded')
  await installPlanReplacement(ctx)
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
