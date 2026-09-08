/**
 * Browser half: occupies conversation.input.plan and takes over
 * conversation.composer for Grok plan approval.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '../types.ts'
import { PlanChip, type PlanChipInjected } from './PlanChip.tsx'
import { PlanReview, type GrokReviewWait } from './PlanReview.tsx'
import { en, zh, type GrokPlanKey } from './locales.ts'
import { REVIEW_QUESTION_ID } from '../types.ts'

export type { GrokPlanKey }

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'grok-plan': GrokPlanKey
  }
}

const NS = 'grok-plan'

export const name = 'grok-plan-mode-ui'
export const inject = ['slots', 'remote', 'remote.commands', 'locale']

function isGrokReviewWait(value: { kind: string }): value is GrokReviewWait {
  if (value.kind !== 'question' && value.kind !== 'plan-review') return false
  if (!('questions' in value) || !Array.isArray(value.questions)) return false
  if (!('answer' in value) || typeof value.answer !== 'function') return false
  if (!('key' in value) || typeof value.key !== 'string') return false
  if (!('sessionId' in value) || typeof value.sessionId !== 'string') return false
  return true
}

function selectReview({ pendingInteraction }: ComposerChainProps): GrokReviewWait | null {
  if (pendingInteraction === undefined) return null
  if (!isGrokReviewWait(pendingInteraction)) return null
  if (pendingInteraction.questions.length !== 1) return null
  if (pendingInteraction.questions[0]?.id !== REVIEW_QUESTION_ID) return null
  return pendingInteraction
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'grok-plan-mode: dictionaries')

  ctx.slots.inject('conversation.input.plan', () => ctx.slots.register({
    name: 'conversation.input.plan',
    locale: NS,
    inject: (sessionId: SessionId): PlanChipInjected => ({
      exitPlanMode: async () => {
        const result = await ctx.remote.commands.execute(sessionId, '/plan off', [])
        if (!result.ok) return `${result.error.message} (${result.error.code})`
        if (result.value === undefined) return 'unknown command: /plan off'
        return null
      },
    }),
  }, PlanChip))

  ctx.slots.inject('conversation.composer', () => ctx.slots.register(
    { name: 'conversation.composer', select: selectReview, locale: NS, priority: -10 },
    PlanReview,
  ))
}
