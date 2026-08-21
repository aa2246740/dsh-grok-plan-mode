/**
 * Browser half: plan review composer only.
 * Do not occupy conversation.input.plan — /plan is the entry, not a chip.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { REVIEW_QUESTION_ID, type GrokPlanProjection } from '../types.ts'

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    'grok-plan': GrokPlanProjection
  }
}
import { PlanReview, type QuestionWait } from './PlanReview.tsx'
import { en, zh, type GrokPlanKey } from './locales.ts'

export type { GrokPlanKey }

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'grok-plan': GrokPlanKey
  }
}

const NS = 'grok-plan'

export const name = 'grok-plan-mode-ui'
export const inject = ['slots', 'locale']

function selectReview({ interactions }: ComposerChainProps): QuestionWait | null {
  const wait = interactions.find((item): item is QuestionWait => {
    return item !== null && typeof item === 'object' && 'kind' in item && item.kind === 'question'
  })
  if (wait === undefined) return null
  if (wait.payload.questions.length !== 1) return null
  if (wait.payload.questions[0]?.id !== REVIEW_QUESTION_ID) return null
  return wait
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'grok-plan-mode: dictionaries')

  ctx.slots.inject('conversation.composer', () => ctx.slots.register(
    { name: 'conversation.composer', select: selectReview, locale: NS, priority: -10 },
    PlanReview,
  ))
}
