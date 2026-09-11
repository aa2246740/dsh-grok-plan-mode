import { useMemo, useState } from 'react'
import { Button, IconEditOutline16, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  APPROVE_LABEL,
  EMPTY_PLAN_PLACEHOLDER,
  QUIT_LABEL,
  REQUEST_CHANGES_LABEL,
  REVIEW_QUESTION_ID,
} from '../types.ts'
import css from './PlanReview.module.css'

export interface GrokReviewWait {
  kind: 'question' | 'plan-review'
  key: string
  sessionId: string
  questions: ReadonlyArray<{
    id: string
    question: string
    detail?: string
    options?: ReadonlyArray<{ label: string; description?: string }>
  }>
  answer: (result: {
    answers: Array<{ id: string; selected: string[]; custom?: string }>
  }) => Promise<void>
}

export type PlanReviewProps =
  PropsRuntime<'conversation.composer'> & { matched: GrokReviewWait } & PropsLocale<'grok-plan'>

function tooltip(description: string | undefined): { title?: string } {
  return description === undefined ? {} : { title: description }
}

export function PlanReview({ matched, t }: PlanReviewProps) {
  const question = matched.questions[0]
  const raw = question?.detail ?? ''
  const hasPlan = raw.trim() !== '' && raw !== EMPTY_PLAN_PLACEHOLDER
  const plan = hasPlan ? raw : EMPTY_PLAN_PLACEHOLDER
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const markdownLabels = useMemo(() => ({
    code: { copyLabel: t('copy'), copiedLabel: t('copied') },
    footnotes: t('markdown.footnotes'),
  }), [t])

  const settle = (send: () => Promise<void>): void => {
    setBusy(true)
    setError(null)
    void send().catch((cause: unknown) => {
      setBusy(false)
      setError(cause instanceof Error ? cause.message : String(cause))
    })
  }

  const decide = (label: string): void => {
    settle(() => matched.answer({
      answers: [{ id: REVIEW_QUESTION_ID, selected: [label] }],
    }))
  }

  const changes = question?.options?.find(option => option.label === REQUEST_CHANGES_LABEL)
  const quit = question?.options?.find(option => option.label === QUIT_LABEL)
  const approve = question?.options?.find(option => option.label === APPROVE_LABEL)

  return (
    <div className={css.frame} data-grok-plan-review={matched.key}>
      <section className={css.card} aria-label={question?.question ?? t('review.header')}>
        <div className={css.strip}>
          <span className={css.dot} />
          {hasPlan ? t('review.waiting') : t('review.empty')}
        </div>
        <div className={css.body} data-grok-plan-review-scroll>
          <MarkdownText text={plan} labels={markdownLabels} />
        </div>
        <div className={css.footer}>
          <div className={css.feedback} role="status">{error}</div>
          <div className={css.actions}>
            <Button
              variant="ghost"
              className={css.discuss}
              icon={<IconEditOutline16 size={14} />}
              {...tooltip(changes?.description)}
              disabled={busy}
              onClick={() => { decide(REQUEST_CHANGES_LABEL) }}
            >
              {t('review.discuss')}
            </Button>
            <Button
              variant="outline"
              {...tooltip(quit?.description)}
              disabled={busy}
              onClick={() => { decide(QUIT_LABEL) }}
            >
              {t('review.quit')}
            </Button>
            <Button
              variant="primary"
              {...tooltip(approve?.description)}
              disabled={busy}
              onClick={() => { decide(APPROVE_LABEL) }}
            >
              {t('review.approve')}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
