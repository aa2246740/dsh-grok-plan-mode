import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import { z as zod } from 'zod'
import { GROK_PLAN_EVENT, viewFromSnapshot } from './fold.ts'
import type { GrokPlanEventData, GrokPlanProjection } from './types.ts'

const grokPlanStateSchema = zod.union([
  zod.null(),
  zod.object({
    state: zod.enum(['Inactive', 'Pending', 'Active', 'ExitPending']),
    was_previously_active: zod.boolean(),
    reminder_count: zod.number(),
    pending_exit_reminder: zod.boolean(),
    awaiting_plan_approval: zod.boolean(),
    plan_file_path: zod.string(),
    plan_has_content: zod.boolean().optional(),
  }),
])

const grokPlanViewSchema = zod.object({
  state: zod.enum(['Inactive', 'Pending', 'Active', 'ExitPending']),
  active: zod.boolean(),
  pending: zod.boolean(),
  awaitingApproval: zod.boolean(),
  hasPlan: zod.boolean(),
  planContent: zod.string().nullable(),
  planFilePath: zod.string(),
  status: zod.enum(['off', 'plan', 'plan approval']),
})

export const grokPlanProjectionDefinition = {
  key: 'grok-plan',
  stateVersion: 1,
  stateSchema: grokPlanStateSchema,
  init: (): GrokPlanEventData | null => null,
  apply: (state, event) => {
    if (event.type !== GROK_PLAN_EVENT) return state
    const parsed = grokPlanStateSchema.safeParse(event.data)
    if (!parsed.success || parsed.data === null) return state
    return parsed.data
  },
  wire: {
    viewSchema: grokPlanViewSchema,
    view: (state): GrokPlanProjection => viewFromSnapshot(state ?? undefined),
  },
} satisfies ProjectionDefinition<'grok-plan', GrokPlanEventData | null>
