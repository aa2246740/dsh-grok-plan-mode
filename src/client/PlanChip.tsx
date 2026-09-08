import { useEffect, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconCloseFill14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { GrokPlanProjection } from '../types.ts'
import css from './PlanChip.module.css'

export interface PlanChipInjected {
  /**
   * Leave plan mode by executing /plan off.
   * @returns null on admitted execution; a user-visible failure line otherwise.
   */
  exitPlanMode: () => Promise<string | null>
}

export type PlanChipProps =
  PropsRuntime<'conversation.input.plan'> & InjectFace<PlanChipInjected> & PropsLocale<'grok-plan'>

export function PlanChip({ useProjection, locked, exitPlanMode, t }: PlanChipProps) {
  const plan = useProjection('grok-plan')
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  if (plan === undefined || plan.status === 'off') return null
  const approval = isApproval(plan)

  const off = (): void => {
    setLeaving(true)
    setError(null)
    void exitPlanMode().then((failure) => {
      if (!aliveRef.current) return
      setLeaving(false)
      setError(failure)
    }, (reason: unknown) => {
      if (!aliveRef.current) return
      setLeaving(false)
      setError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  return (
    <span className={css.wrap}>
      <button
        type="button"
        className={approval ? css.approval : css.chip}
        aria-label={approval ? t('chip.approval.aria') : t('chip.on.aria')}
        title={approval ? t('chip.approval.aria') : t('chip.on.title')}
        disabled={locked || leaving}
        onClick={off}
      >
        {approval ? t('chip.approval') : t('chip.label')}
        <span className={css.close} aria-hidden>
          <IconCloseFill14 size={12} />
        </span>
      </button>
      {error !== null && <span className={css.error} role="status" title={error}>{t('chip.exitFailed')}</span>}
    </span>
  )
}

function isApproval(plan: GrokPlanProjection): boolean {
  return plan.status === 'plan approval'
}
