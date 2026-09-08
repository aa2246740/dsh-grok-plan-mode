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
import css from './PlanReview.module.css'

export interface GrokReviewWait {
  kind: 'question' | 'plan-review'
  key: string
  sessionId: string
  questions: ReadonlyArray<{
    id: string
    question: string
    detail?: string
  }>
  answer: (result: {
    answers: Array<{ id: string; selected: string[]; custom?: string }>
  }) => Promise<void>
}

export type PlanReviewProps =
  PropsRuntime<'conversation.composer'> & { matched: GrokReviewWait } & PropsLocale<'grok-plan'>

export function PlanReview({ matched, t }: PlanReviewProps) {
  const question = matched.questions[0]
  const raw = question?.detail ?? ''
  const hasPlan = raw.trim() !== '' && raw !== EMPTY_PLAN_PLACEHOLDER
  const plan = hasPlan ? raw : EMPTY_PLAN_PLACEHOLDER
  const lines = plan.split('\n')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [commentText, setCommentText] = useState('')
  const [anchor, setAnchor] = useState<number | null>(null)
  const [focus, setFocus] = useState<number | null>(null)
  const [comments, setComments] = useState<PlanComment[]>([])
  const [nextId, setNextId] = useState(0)

  const markdownLabels = useMemo(() => ({
    code: { copyLabel: t('copy'), copiedLabel: t('copied') },
    footnotes: t('markdown.footnotes'),
  }), [t])

  const selection = anchor === null || focus === null
    ? null
    : { start: Math.min(anchor, focus), end: Math.max(anchor, focus) }

  const send = (label: string, custom?: string): void => {
    setBusy(true)
    setError(null)
    void matched.answer({
      answers: [{
        id: REVIEW_QUESTION_ID,
        selected: [label],
        ...custom !== undefined && custom.trim() !== '' ? { custom } : {},
      }],
    }).catch((cause: unknown) => {
      setBusy(false)
      setError(cause instanceof Error ? cause.message : String(cause))
    })
  }

  const addComment = (): void => {
    if (selection === null || commentText.trim() === '') return
    setComments(current => [...current, {
      id: nextId,
      lineStart: selection.start,
      lineEnd: selection.end + 1,
      text: commentText.trim(),
    }])
    setNextId(id => id + 1)
    setCommentText('')
  }

  return (
    <div className={css.frame} data-grok-plan-review={matched.key}>
      <section className={css.card} aria-label={question?.question ?? t('review.header')}>
        <div className={css.strip}>
          <span className={css.dot} />
          {hasPlan ? t('review.waiting') : t('review.empty')}
        </div>
        <div className={css.body} data-grok-plan-review-scroll>
          <MarkdownText text={plan} labels={markdownLabels} />
          <p className={css.hint}>{t('review.lines')}</p>
          <ol className={css.source}>
            {lines.map((line, index) => {
              const lineNumber = index + 1
              const selected = selection !== null
                && lineNumber >= selection.start
                && lineNumber <= selection.end
              return (
                <li key={lineNumber} className={selected ? css.selected : undefined}>
                  <button
                    type="button"
                    className={css.gutter}
                    disabled={busy}
                    aria-label={`${lineNumber}`}
                    onClick={() => {
                      if (anchor === null || (focus !== null && anchor !== focus)) {
                        setAnchor(lineNumber)
                        setFocus(lineNumber)
                        return
                      }
                      setFocus(lineNumber)
                    }}
                  >
                    {lineNumber}
                  </button>
                  <pre className={css.line}>{line.length === 0 ? ' ' : line}</pre>
                </li>
              )
            })}
          </ol>
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
            {t('review.comment')}
            <div className={css.row}>
              <input
                className={css.input}
                value={commentText}
                placeholder={t('review.comment.placeholder')}
                disabled={busy || selection === null}
                onChange={event => { setCommentText(event.target.value) }}
              />
              <Button variant="outline" disabled={busy || selection === null || commentText.trim() === ''} onClick={addComment}>
                {t('review.addComment')}
              </Button>
            </div>
          </label>
          <label className={css.label}>
            {t('review.notes')}
            <textarea
              className={css.notes}
              value={notes}
              placeholder={t('review.notes.placeholder')}
              disabled={busy}
              onChange={event => { setNotes(event.target.value) }}
            />
          </label>
        </div>
        <div className={css.footer}>
          <div className={css.feedback} role="status">{error}</div>
          <div className={css.actions}>
            <Button variant="ghost" disabled={busy} onClick={() => { send(QUIT_LABEL) }}>
              {t('review.quit')}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                send(REQUEST_CHANGES_LABEL, formatFeedback({
                  comments,
                  planContent: hasPlan ? plan : undefined,
                  source: 'file_backed',
                  freeform: notes,
                }))
              }}
            >
              {t('review.changes')}
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => { send(APPROVE_LABEL) }}
            >
              {t('review.approve')}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
