import type { Context } from '@deepseek-ai/cordis'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Session, UserMessage } from '@deepseek-ai/dsh-session'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { PreToolDecision } from '@deepseek-ai/dsh-tools'
import { UserQuestionError } from '@deepseek-ai/dsh-user-questions'
import { z as zod } from 'zod'
import { classifyToolAccess, isPlanningAgent, planModeEditGate, resolveEditPath } from '../gate.ts'
import {
  foldGrokPlan,
  GROK_PLAN_EVENT,
  hasOpenTurn,
  officialPlanView,
  viewFromSnapshot,
} from '../fold.ts'
import {
  adoptLegacyPlanFile,
  planFileHasContent,
  probeOrCreateEmptyPlanFile,
  readPlanFile,
  resolvePlanFilePath,
  writePlanModeJson,
} from '../plan-file.ts'
import {
  ENTER_PLAN_MODE_DESCRIPTION,
  ENTERED_PLAN_MODE_MESSAGE,
  EXIT_EMPTY_PLAN_MESSAGE,
  EXIT_PLAN_APPROVED_MESSAGE,
  EXIT_PLAN_MODE_DESCRIPTION,
  formatEnterPlanMode,
  formatExitPlanReady,
} from '../prompts.ts'
import {
  planModeEditRejected,
  planModeExitReminder,
  planModeReentryReminder,
  planModeReminderFull,
  planModeReminderSparse,
  wrapSystemReminder,
} from '../reminders.ts'
import { abandonedPlanMessage, displayPlanContent, resumeActionFor, revisePlanMessage } from '../review.ts'
import { PlanModeTracker } from '../tracker.ts'
import type { EnterPlanModeToolHints, GrokPlanProjection, PlanApprovalOutcome } from '../types.ts'
import {
  APPROVE_LABEL,
  DEFAULT_TOOL_HINTS,
  ENTER_PLAN_MODE,
  EXIT_PLAN_MODE,
  outcomeFromLabel,
  PLAN_APPROVED_IMPLEMENT_MESSAGE,
  QUIT_LABEL,
  REQUEST_CHANGES_LABEL,
  REVIEW_QUESTION_ID,
} from '../types.ts'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'grok-plan/state': {
      state: 'Inactive' | 'Pending' | 'Active' | 'ExitPending'
      was_previously_active: boolean
      reminder_count: number
      pending_exit_reminder: boolean
      awaiting_plan_approval: boolean
      plan_file_path: string
    }
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    plan: { active: boolean; pending: boolean }
    'grok-plan': GrokPlanProjection
  }
}

interface ToolHints extends EnterPlanModeToolHints {
  edit: string
}

export function applyGrokPlanMode(ctx: Context): void {
  const trackers = new WeakMap<Session, PlanModeTracker>()

  const trackerOf = (agent: Agent): PlanModeTracker => {
    const existing = trackers.get(agent.session)
    if (existing !== undefined) return existing
    const paths = pathsOf(agent)
    const folded = foldGrokPlan(agent.session.events)
    const aliases = paths.sessionPlanPath === paths.planFilePath ? [] : [paths.sessionPlanPath]
    const tracker = folded === undefined
      ? new PlanModeTracker(paths.sessionDir, paths.planFilePath, aliases)
      : PlanModeTracker.fromSnapshot(paths.sessionDir, folded, paths.planFilePath, aliases)
    trackers.set(agent.session, tracker)
    return tracker
  }

  const persist = (agent: Agent): void => {
    const tracker = trackerOf(agent)
    const data = {
      ...tracker.snapshot(),
      plan_file_path: tracker.planFilePath(),
    }
    agent.session.append(GROK_PLAN_EVENT, data)
    void writePlanModeJson(pathsOf(agent).sessionDir, data).catch((error: unknown) => {
      ctx.logger?.warn?.('dsh-grok-plan-mode: failed to write plan_mode.json: %o', error)
    })
  }

  const hintsOf = (): ToolHints => toolHints(ctx)

  ctx.on('agent/session-start', ({ agent, source }) => {
    const tracker = trackerOf(agent)
    if (source === 'compact') tracker.resetAfterCompaction()
  })

  ctx.on('session/event', (session, event) => {
    if (event.type !== 'turn/end') return
    const tracker = trackers.get(session)
    if (tracker === undefined || tracker.getState() !== 'ExitPending') return
    tracker.completeDeferredExit()
    const agent = findAgent(ctx, session)
    if (agent !== undefined) persist(agent)
  })

  ctx.on('agent/pre-step', async ({ agent, signal }, next): Promise<PreStepDecision> => {
    const decision = await next()
    if (decision.kind === 'reject' || signal.aborted) return decision
    const tracker = trackerOf(agent)
    const injections: UserMessage[] = []
    const hints = hintsOf()

    if (tracker.getState() === 'Pending') {
      const reentry = tracker.isReentry()
      tracker.activate()
      persist(agent)
      const seed = await ensurePlanFile(agent, tracker)
      const text = reentry
        ? planModeReentryReminder({ planPath: tracker.planFilePath(), tools: hints })
        : planModeReminderFull({
          planPath: tracker.planFilePath(),
          planHasContent: seed.kind === 'non_empty' || await planFileHasContent(tracker.planFilePath()),
          tools: hints,
        })
      injections.push(notice(wrapSystemReminder(text)))
      tracker.recordReminderInjected()
      persist(agent)
    } else if (tracker.hasPendingActivation()) {
      const text = tracker.takePendingActivation()
      if (text !== undefined) {
        injections.push(notice(text))
        tracker.recordReminderInjected()
        persist(agent)
      }
    } else if (tracker.hasPendingExitReminder()) {
      injections.push(notice(wrapSystemReminder(planModeExitReminder())))
      tracker.clearPendingExitReminder()
      persist(agent)
    } else if (tracker.isActive()) {
      const text = tracker.shouldUseFullReminder()
        ? planModeReminderFull({
          planPath: tracker.planFilePath(),
          planHasContent: await planFileHasContent(tracker.planFilePath()),
          tools: hints,
        })
        : planModeReminderSparse()
      injections.push(notice(wrapSystemReminder(text)))
      tracker.recordReminderInjected()
      persist(agent)
    }

    if (injections.length === 0) return decision
    return { kind: 'enter', messages: [...decision.messages, ...injections] }
  })

  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    const agent = exec.agent
    if (agent === undefined) return next()
    if (!isPlanningAgent(agent.session.header)) return next()
    const tracker = trackerOf(agent)
    const access = classifyToolAccess({ name: exec.name, arguments: exec.arguments })
    const resolved = access.kind === 'edit'
      ? { kind: 'edit' as const, path: resolveEditPath(access.path, agent.session.header.cwd) }
      : access
    if (planModeEditGate(tracker, resolved) === 'reject_non_plan_file') {
      return { kind: 'deny', reason: planModeEditRejected(tracker.planFilePath()) }
    }
    return next()
  })

  {
    const register = (name: string, description: string, hint: string, handler: typeof handlePlan) => {
      ctx.commands.register({
        name,
        description,
        ...hint.trim() === ''
          ? {}
          : { input: { hint, images: true } },
        handler,
      })
    }

    const handlePlan = ({ agent, rawInput, attachments }) => {
      const message = rawInput.trim()
      const tracker = trackerOf(agent)
      if (message === '' && attachments.length === 0) {
        if (tracker.getState() === 'Inactive' || tracker.getState() === 'ExitPending') {
          enterFromCommand(agent, tracker)
          persist(agent)
          return { kind: 'success' as const, text: 'Plan mode on. Active on your next prompt.' }
        }
        return { kind: 'success' as const, text: alreadyInPlanText(tracker) }
      }
      enterFromCommand(agent, tracker)
      persist(agent)
      agent.steer(createUserMessage({
        content: [
          ...attachments,
          ...(message === '' ? [] : [{ type: 'text' as const, text: message }]),
        ],
        source: { kind: 'user' },
      }))
      return { kind: 'success' as const, text: 'Plan mode on. Starting this turn under plan mode.' }
    }

    register('plan', 'Enter plan mode', '[description]', handlePlan)

    const leave = ({ agent }) => {
      const tracker = trackerOf(agent)
      if (tracker.getState() === 'Inactive' && !tracker.isAwaitingPlanApproval()) {
        return { kind: 'success' as const, text: 'Plan mode is already off.' }
      }
      tracker.userExit(hasOpenTurn(agent.session.events))
      persist(agent)
      return { kind: 'success' as const, text: 'Left plan mode.' }
    }
    register('grok-plan-leave', 'Leave plan mode', '', leave)

    const viewPlan = async ({ agent, signal }) => {
      const tracker = trackerOf(agent)
      if (tracker.getState() === 'Inactive' && !tracker.isAwaitingPlanApproval()) {
        return { kind: 'error' as const, text: 'No plan mode session is active. Use /plan first.' }
      }
      try {
        const { outcome, feedback } = await presentReview(ctx, agent, tracker, signal, persist)
        if (outcome === 'approved') {
          agent.steer(createUserMessage({
            content: [{ type: 'text', text: PLAN_APPROVED_IMPLEMENT_MESSAGE }],
            source: { kind: 'user' },
          }))
          return { kind: 'success' as const, text: 'Plan approved. Starting implementation.' }
        }
        if (outcome === 'cancelled') {
          agent.steer(createUserMessage({
            content: [{ type: 'text', text: revisePlanMessage(feedback) }],
            source: { kind: 'user' },
          }))
          return { kind: 'success' as const, text: 'Staying in plan mode with your notes.' }
        }
        return { kind: 'success' as const, text: 'Plan abandoned. Plan mode is off.' }
      } catch (error) {
        return { kind: 'error' as const, text: errorMessage(error) }
      }
    }
    for (const name of ['view-plan', 'show-plan', 'plan-view'] as const) {
      register(name, 'Open a preview of the current saved plan', '', viewPlan)
    }
  }

  {
    const projectionCtx = ctx
    type UnitState = ReturnType<typeof foldGrokPlan> | { readonly empty: true }
    const grokPlanSchema = zod.object({
      state: zod.enum(['Inactive', 'Pending', 'Active', 'ExitPending']),
      active: zod.boolean(),
      pending: zod.boolean(),
      awaitingApproval: zod.boolean(),
      hasPlan: zod.boolean(),
      planContent: zod.string().nullable(),
      planFilePath: zod.string(),
      status: zod.enum(['off', 'plan', 'plan approval']),
    })
    const officialPlanSchema = zod.object({
      active: zod.boolean(),
      pending: zod.boolean(),
    })
    projectionCtx.sessionProjections.register({
      key: 'grok-plan',
      schema: grokPlanSchema,
      init: (): UnitState => ({ empty: true }),
      apply: (state: UnitState, event) => event.type === GROK_PLAN_EVENT ? event.data : state,
      view: (state: UnitState) => viewFromSnapshot('empty' in state ? undefined : state),
      stateVersion: 1,
    })
    projectionCtx.sessionProjections.register({
      key: 'plan',
      schema: officialPlanSchema,
      init: (): UnitState => ({ empty: true }),
      apply: (state: UnitState, event) => event.type === GROK_PLAN_EVENT ? event.data : state,
      view: (state: UnitState) => officialPlanView(viewFromSnapshot('empty' in state ? undefined : state)),
      stateVersion: 1,
    })
  }

  ctx.tools.register(defineTool({
    name: ENTER_PLAN_MODE,
    description: ENTER_PLAN_MODE_DESCRIPTION,
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          message: { type: 'string', required: true },
          plan_file_path: { type: 'string', required: true },
          plan_file_seed: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.message }],
    },
    execute: async (_args, exec) => {
      const agent = exec.agent
      if (agent === undefined) throw new Error(`${ENTER_PLAN_MODE} requires a calling agent`)
      const tracker = trackerOf(agent)
      tracker.activateFromTool()
      const seed = await ensurePlanFile(agent, tracker)
      persist(agent)
      const hints = hintsOf()
      const text = formatEnterPlanMode({
        message: ENTERED_PLAN_MODE_MESSAGE,
        planFilePath: tracker.planFilePath(),
        planFileSeed: seed,
        toolHints: hints,
      })
      return {
        message: text,
        plan_file_path: tracker.planFilePath(),
        plan_file_seed: seed.kind,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: EXIT_PLAN_MODE,
    description: EXIT_PLAN_MODE_DESCRIPTION,
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          message: { type: 'string', required: true },
          approved: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.message }],
    },
    execute: async (_args, exec) => {
      const agent = exec.agent
      if (agent === undefined) throw new Error(`${EXIT_PLAN_MODE} requires a calling agent`)
      const tracker = trackerOf(agent)
      if (!tracker.isActive()) {
        throw new Error(`${EXIT_PLAN_MODE} is only available in plan mode`)
      }
      const { outcome, feedback } = await presentReview(ctx, agent, tracker, exec.signal, persist)
      if (outcome === 'approved') {
        const content = await readPlanFile(tracker.planFilePath())
        const message = content === undefined
          ? EXIT_EMPTY_PLAN_MESSAGE
          : formatExitPlanReady({
            message: EXIT_PLAN_APPROVED_MESSAGE,
            planFilePath: tracker.planFilePath(),
            planContent: content,
          })
        return { message, approved: true }
      }
      if (outcome === 'abandoned') throw new Error(abandonedPlanMessage())
      throw new Error(revisePlanMessage(feedback))
    },
  }))
}

async function presentReview(
  ctx: Context,
  agent: Agent,
  tracker: PlanModeTracker,
  signal: AbortSignal | undefined,
  persist: (agent: Agent) => void,
): Promise<{ outcome: PlanApprovalOutcome; feedback: string }> {
  const questions = ctx.get('userQuestions')
  if (questions === undefined) {
    throw new Error('no interactive client is available to review the plan; stay in plan mode')
  }
  const plan = await readPlanFile(tracker.planFilePath())
  tracker.setAwaitingPlanApproval(true)
  persist(agent)
  try {
    const answer = await questions.ask({
      questions: [{
        id: REVIEW_QUESTION_ID,
        header: 'Plan approval',
        question: 'Review this plan. Auto and always-approve do not skip this step.',
        detail: displayPlanContent(plan),
        // Official RPC rejects selected+custom together unless multiSelect.
        // Notes / line comments ride in `custom`; the action stays in `selected`.
        multiSelect: true,
        options: [
          { label: APPROVE_LABEL, description: 'Leave plan mode and start implementing.' },
          { label: REQUEST_CHANGES_LABEL, description: 'Stay in plan mode and send notes back to the model.' },
          { label: QUIT_LABEL, description: 'Abandon the plan and turn plan mode off.' },
        ],
      }],
      agent,
      signal,
    })
    const item = answer.answers.find(entry => entry.id === REVIEW_QUESTION_ID)
    const label = item?.selected[0] ?? ''
    const outcome = outcomeFromLabel(label)
    const feedback = item?.custom ?? ''
    applyOutcome(agent, tracker, outcome, feedback)
    persist(agent)
    return { outcome, feedback }
  } catch (error) {
    tracker.setAwaitingPlanApproval(false)
    persist(agent)
    if (error instanceof UserQuestionError && error.code === 'ASK_CANCELLED') {
      throw new Error('The user dismissed the plan review to speak instead; stay in plan mode, stop here, and wait for their message.')
    }
    if (error instanceof UserQuestionError && error.code === 'NO_PROVIDER') {
      throw new Error('no interactive client is available to review the plan; stay in plan mode')
    }
    throw error
  }
}

function applyOutcome(
  agent: Agent,
  tracker: PlanModeTracker,
  outcome: PlanApprovalOutcome,
  feedback: string,
): void {
  const action = resumeActionFor(outcome, feedback)
  if (action.kind === 'leave_and_implement') {
    tracker.deactivateApproved()
    return
  }
  if (action.kind === 'leave_only') {
    tracker.userExit(false)
    return
  }
  tracker.setAwaitingPlanApproval(false)
}

async function ensurePlanFile(agent: Agent, tracker: PlanModeTracker) {
  const paths = pathsOf(agent)
  await adoptLegacyPlanFile(paths.sessionPlanPath, tracker.planFilePath())
  return probeOrCreateEmptyPlanFile(tracker.planFilePath())
}

function enterFromCommand(agent: Agent, tracker: PlanModeTracker): void {
  tracker.enterPending()
  if (hasOpenTurn(agent.session.events) && tracker.getState() === 'Pending') {
    const text = wrapSystemReminder(planModeReminderFull({
      planPath: tracker.planFilePath(),
      planHasContent: false,
    }))
    tracker.activateMidTurn(text)
  }
}

function alreadyInPlanText(tracker: PlanModeTracker): string {
  if (tracker.isAwaitingPlanApproval()) return 'Plan approval is already open. Use the review surface or /view-plan.'
  return 'Plan mode is already on.'
}

function pathsOf(agent: Agent): ReturnType<typeof resolvePlanFilePath> {
  return resolvePlanFilePath({
    sessionId: agent.session.id,
    cwd: agent.session.header.cwd,
  })
}

function toolHints(ctx: Context): ToolHints {
  const names = new Set<string>()
  try {
    const schemas = (ctx as { tools?: { schemas?: () => readonly { name: string }[] } }).tools?.schemas?.()
    for (const item of schemas ?? []) names.add(item.name)
  } catch {
    // Catalog read is best-effort; reminders fall back to Grok defaults.
  }
  const edit = names.has('str_replace_editor')
    ? 'str_replace_editor'
    : names.has('edit')
      ? 'edit'
      : names.has('write')
        ? 'write'
        : 'str_replace_editor'
  return {
    ...DEFAULT_TOOL_HINTS,
    ask_user: names.has('ask_user_question') ? 'ask_user_question' : DEFAULT_TOOL_HINTS.ask_user,
    edit,
    task: names.has('task') ? 'task' : '',
  }
}

function notice(text: string): UserMessage {
  return createUserMessage({
    content: [{ type: 'text', text }],
    source: {
      kind: 'plugin',
      plugin: 'grok-plan-mode',
      form: 'notice',
      summary: text.split('\n')[0] ?? 'plan mode',
    },
  })
}

function findAgent(ctx: Context, session: Session): Agent | undefined {
  const agents = (ctx as { get: (name: string) => { get?: (id: string) => Agent | undefined } | undefined }).get('agents')
  return agents?.get?.(session.id)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
