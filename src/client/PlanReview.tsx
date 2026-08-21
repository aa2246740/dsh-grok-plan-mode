import { useMemo, useState } from 'react'
import { Button, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { formatFeedback } from '../review.ts'
import {
  APPROVE_LABEL,
  EMPTY_PLAN_PLACEHOLDER,
  QUIT_LABEL,
  REQUEST_CHANGES_LABEL,
  REVIEW_QUESTION_ID,
} from '../types.ts'
import type { PlanComment } from '../types.ts'
import type { GrokPlanKey } from './locales.ts'
import css from './PlanReview.module.css'

export interface QuestionWait {
  kind: 'question'
  key: string
  sessionId: string
  payload: {
    questions: ReadonlyArray<{
      id: string
      question: string
      detail?: string
      options?: ReadonlyArray<{ label: string; description?: string }>
    }>
  }
  respond: (result: {
    ok: boolean
    value?: { sessionId: string; answer: { answers: Array<{ id: string; selected: string[]; custom?: string }> } }
    error?: { code: string; message: string; details: Record<string, never> }
  }) => Promise<{ accepted: boolean; reason?: string }>
}

export type PlanReviewProps =
  PropsRuntime<'conversation.composer'> & { matched: QuestionWait } & PropsLocale<'grok-plan'>

export function PlanReview({ matched, t }: PlanReviewProps) {
  const question = matched.payload.questions[0]
  const raw = question?.detail ?? ''
  const hasPlan = raw.trim() !== '' && raw !== EMPTY_PLAN_PLACEHOLDER
  const plan = hasPlan ? raw : EMPTY_PLAN_PLACEHOLDER
  const lines = plan.split('\n')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [commentText, setCommentText] = useState('')
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null)
  const [comments, setComments] = useState<PlanComment[]>([])
  const [nextId, setNextId] = useState(0)

  const pending = useMemo(() => matched, [matched])

  const send = (label: string, custom?: string): void => {
    setBusy(true)
    setError(null)
    void pending.respond({
      ok: true,
      value: {
        sessionId: pending.sessionId,
        answer: {
          answers: [{
            id: REVIEW_QUESTION_ID,
            selected: [label],
            ...custom !== undefined && custom.trim() !== '' ? { custom } : {},
          }],
        },
      },
    }).then((receipt) => {
      if (!receipt.accepted) {
        setBusy(false)
        setError(receipt.reason ?? 'review response rejected')
      }
    }, (cause: unknown) => {
      setBusy(false)
      setError(cause instanceof Error ? cause.message : String(cause))
    })
  }

  const addComment = (): void => {
    if (selection === null || commentText.trim() === '') return
    const start = Math.min(selection.start, selection.end)
    const end = Math.max(selection.start, selection.end) + 1
    setComments(current => [...current, {
      id: nextId,
      lineStart: start,
      lineEnd: end,
      text: commentText.trim(),
    }])
    setNextId(id => id + 1)
    setCommentText('')
  }

  return (
    <div className={css.frame} data-grok-plan-review={pending.key}>
      <section className={css.card} aria-label={question?.question ?? t('review.header' as GrokPlanKey)}>
        <div className={css.strip}>
          <span className={css.dot} />
          {hasPlan ? t('review.waiting' as GrokPlanKey) : t('review.empty' as GrokPlanKey)}
        </div>
        <div className={css.body}>
          <div className={css.lines} onMouseUp={() => {
            const picked = window.getSelection()
            if (picked === null || picked.rangeCount === 0) return
            const text = picked.toString()
            if (text.trim() === '') return
            const start = lineIndex(lines, picked.anchorOffset, plan)
            const end = lineIndex(lines, picked.focusOffset, plan)
            if (start === undefined || end === undefined) return
            setSelection({ start: Math.min(start, end), end: Math.max(start, end) })
          }}
          >
            <MarkdownText text={plan} />
          </div>
          {comments.length > 0 && (
            <ol className={css.comments}>
              {comments.map(comment => (
                <li key={comment.id}>
                  @{`plan.md:${comment.lineStart}`}
                  {comment.lineEnd - comment.lineStart > 1 ? `-${comment.lineEnd - 1}` : ''}
                  {' '}
                  {comment.text}
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className={css.composer}>
          <label className={css.label}>
            {t('review.comment' as GrokPlanKey)}
            <div className={css.row}>
              <input
                className={css.input}
                value={commentText}
                placeholder={t('review.comment.placeholder' as GrokPlanKey)}
                disabled={busy || selection === null}
                onChange={event => { setCommentText(event.target.value) }}
              />
              <Button variant="outline" disabled={busy || selection === null || commentText.trim() === ''} onClick={addComment}>
                {t('review.addComment' as GrokPlanKey)}
              </Button>
            </div>
          </label>
          <label className={css.label}>
            {t('review.notes' as GrokPlanKey)}
            <textarea
              className={css.notes}
              value={notes}
              placeholder={t('review.notes.placeholder' as GrokPlanKey)}
              disabled={busy}
              onChange={event => { setNotes(event.target.value) }}
            />
          </label>
        </div>
        <div className={css.footer}>
          <div className={css.feedback} role="status">{error}</div>
          <div className={css.actions}>
            <Button variant="ghost" disabled={busy} onClick={() => { send(QUIT_LABEL) }}>
              {t('review.quit' as GrokPlanKey)}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                send(REQUEST_CHANGES_LABEL, formatFeedback({
                  comments,
                  planContent: hasPlan ? plan : undefined,
                  freeform: notes,
                }))
              }}
            >
              {t('review.changes' as GrokPlanKey)}
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => {
                const extra = formatFeedback({
                  comments,
                  planContent: hasPlan ? plan : undefined,
                  freeform: notes,
                })
                send(APPROVE_LABEL, extra === '' ? undefined : extra)
              }}
            >
              {t('review.approve' as GrokPlanKey)}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

function lineIndex(lines: readonly string[], offset: number, source: string): number | undefined {
  if (offset < 0 || offset > source.length) return undefined
  let seen = 0
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const next = seen + line.length + (index < lines.length - 1 ? 1 : 0)
    if (offset <= next) return index + 1
    seen = next
  }
  return lines.length
}
