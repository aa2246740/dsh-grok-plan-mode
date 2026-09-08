import type { Context, Fiber } from '@deepseek-ai/cordis'

// Public Loader entry surface, kept structural so non-Loader embedders need no
// loader dependency. Preset trees deliberately do not persist runtime updates.
interface PlanEntry {
  options: { name: string; disabled?: boolean | null }
  fiber?: Fiber
  context: Context
  update(options: { disabled?: boolean | null }): Promise<void>
}
const OFFICIAL_PLAN = '@deepseek-ai/dsh-plan-mode'

/** Suppress the official implementation across existing and future presets.
 * The Loader row stays visible as disabled; no preset file is rewritten.
 * Cordis publishes internal/plugin before executing a new fiber, explicitly
 * allowing synchronous disposal there. Keep that observer active until rollback
 * starts, then restore only rows still carrying our exact options object.
 */
export function installPlanReplacement(ctx: Context): Promise<void> {
  const owned = new Map<PlanEntry, { previous: boolean | null | undefined; options: PlanEntry['options'] }>()
  const pending = new Set<Promise<void>>()
  let restoring = false
  const track = (work: Promise<void>) => {
    pending.add(work)
    void work.finally(() => pending.delete(work)).catch(error => {
      ctx.logger.error('grok-plan replacement lifecycle failed: %o', error)
    })
    return work
  }
  const suppress = (fiber: Fiber) => {
    if (restoring || fiber.uid === null) return
    const entry = (fiber as Fiber & { entry?: PlanEntry }).entry
    if (entry?.options.name !== OFFICIAL_PLAN || entry.options.disabled === true) return
    // Child injection fibers inherit the entry; only its module fiber owns it.
    if (entry.fiber !== undefined && entry.fiber.uid !== null && entry.fiber.uid !== fiber.uid) return
    const previous = entry.options.disabled
    const update = entry.update({ disabled: true })
    const saved = { previous, options: entry.options }
    owned.set(entry, saved)
    // A just-published fiber has not yet been assigned to entry.fiber. Updating
    // the row alone cannot stop that initial constructor; disposal must be sync.
    const dispose = fiber.uid === null ? Promise.resolve() : fiber.dispose()
    track(Promise.all([update, dispose]).then(() => { saved.options = entry.options }))
  }
  const stop = ctx.on('internal/plugin', suppress, { global: true })
  ctx.effect(() => async () => {
    restoring = true
    stop()
    await Promise.allSettled([...pending])
    for (const [entry, saved] of owned) {
      if (entry.context.fiber.uid === null || entry.options !== saved.options || entry.options.disabled !== true) continue
      await entry.update({ disabled: saved.previous ?? null })
    }
    owned.clear()
  }, 'grok-plan: restore replaced official rows')
  for (const runtime of [...ctx.registry.values()]) {
    for (const fiber of [...runtime.fibers]) suppress(fiber)
  }
  return Promise.all([...pending]).then(() => undefined)
}
