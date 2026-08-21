import { useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { GrokPlanKey } from './locales.ts'
import css from './PlanChip.module.css'

export interface PlanChipInjected {
  leavePlanMode: () => Promise<string | null>
}

export type PlanChipProps =
  PropsRuntime<'conversation.input.plan'> & InjectFace<PlanChipInjected> & PropsLocale<'grok-plan'>

export function PlanChip({ useProjection, locked, leavePlanMode, t }: PlanChipProps) {
  const plan = useProjection('grok-plan') as
    | { status: 'off' | 'plan' | 'plan approval' }
    | undefined
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)
  alive.current = true

  if (plan === undefined || plan.status === 'off') return null
  const approval = plan.status === 'plan approval'

  return (
    <span className={css.wrap}>
      <button
        type="button"
        className={approval ? css.approval : css.chip}
        aria-label={approval ? t('chip.approval.aria' as GrokPlanKey) : t('chip.on.aria' as GrokPlanKey)}
        disabled={locked || busy}
        onClick={() => {
          setBusy(true)
          setError(null)
          void leavePlanMode().then((failure) => {
            if (!alive.current) return
            setBusy(false)
            setError(failure)
          }, (reason: unknown) => {
            if (!alive.current) return
            setBusy(false)
            setError(reason instanceof Error ? reason.message : String(reason))
          })
        }}
      >
        {approval ? 'Plan approval' : 'Plan'}
        <span className={css.close} aria-hidden>×</span>
      </button>
      {error !== null && <span className={css.error} role="status">{error}</span>}
    </span>
  )
}
