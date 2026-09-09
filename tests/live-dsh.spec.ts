/**
 * Live DSH package test: mounts the real plugin beside real 0.1.2-rc.1 services.
 * Run the project-local verification helper to use an isolated DSH_HOME:
 *
 *   .dsh/skills/verify-grok-plan-mode/helpers/check.mjs check
 *
 * Uses installed public packages, a fixture Agent, and a test question answerer.
 * Does not certify browser rendering, LLM behavior, or real filesystem policy.
 */
import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { defineContentToolFixture } from '@deepseek-ai/dsh-tools'
import { Session, SessionId, type UserMessage } from '@deepseek-ai/dsh-session'
import AgentRegistry, { agentEvents, type Agent } from '@deepseek-ai/dsh-agent'
import { createScope } from '@deepseek-ai/dsh-scope'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { apply, name, inject } from '../src/index.ts'
import { GROK_PLAN_EVENT } from '../src/fold.ts'
import { ENTER_PLAN_MODE, EXIT_PLAN_MODE, APPROVE_LABEL, REQUEST_CHANGES_LABEL } from '../src/types.ts'

async function agentWithSession(
  ctx: Context,
  id = 'live-1',
): Promise<Agent & { session: Session }> {
  const session = Session.create(SessionId(id), undefined, {
    version: 0,
    id: SessionId(id),
    createdAt: Date.now(),
    cwd: '/tmp/live-dsh-workspace',
    isSeeded: false,
  })
  const agent = {
    id: SessionId(id),
    session,
    options: {},
    steer: vi.fn(),
    inject(message: UserMessage) {
      session.append('user/message', message, { surfaceOp: 'append' })
    },
  } as unknown as Agent & { session: Session }
  let scoped!: Context
  await ctx.plugin(Object.assign((inner: Context) => {
    scoped = createScope(inner, agent).ctx
  }, { inject: ['tools'] }))
  ;(agent as { ctx?: Context }).ctx = scoped
  const agents = ctx.get('agents')
  if (agents === undefined) ctx.emit('agent/created', { agent })
  else {
    agents.enter(agent, undefined)
    agents.announce(agent)
  }
  return agent
}

async function setup(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(CommandRuntime)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(UserQuestionService)
  await ctx.plugin({ apply, name, inject })
  await new Promise(resolve => setImmediate(resolve))
  return ctx
}

async function preStep(ctx: Context, agent: Agent & { session: Session }): Promise<void> {
  const events = agentEvents(ctx, agent)
  const message = createUserMessage({
    content: [{ type: 'text', text: 'boundary' }],
    source: { kind: 'user' },
  })
  const signal = new AbortController().signal
  const decision = await events.waterfall(
    'agent/pre-step',
    { messages: [message], turn: 1, step: 1, signal },
    () => Promise.resolve({ kind: 'enter' as const, messages: [message] }),
  )
  if (decision.kind === 'enter') {
    for (const extra of decision.messages.slice(1)) {
      agent.session.append('user/message', extra, { surfaceOp: 'append' })
    }
  }
}

function pluginNoticeText(type: string, data: unknown): string | undefined {
  if (type !== 'user/message') return undefined
  if (typeof data !== 'object' || data === null) return undefined
  if (!('source' in data) || !('content' in data)) return undefined
  const { source, content } = data
  if (typeof source !== 'object' || source === null || !('kind' in source)) return undefined
  if (source.kind !== 'plugin' || !Array.isArray(content)) return undefined
  return content.map(block => {
    if (typeof block !== 'object' || block === null || !('text' in block)) return ''
    return typeof block.text === 'string' ? block.text : ''
  }).join('')
}

let calls = 0
function exec(ctx: Context, toolName: string, args: unknown, agent?: Agent) {
  return ctx.tools.execute({
    callId: ToolCallId(`live-${++calls}`),
    name: toolName,
    arguments: args,
    signal: new AbortController().signal,
    ...agent ? { agent } : {},
  })
}

describe('live DSH 0.1.2-rc.1: grok-plan-mode', () => {
  it('loads, registers /plan, and activates on the next pre-step', async () => {
    const ctx = await setup()
    const agent = await agentWithSession(ctx)
    const names = ctx.commands.list(agent).map(command => command.name)
    expect(names).toEqual(expect.arrayContaining(['plan', 'view-plan', 'show-plan', 'plan-view', 'grok-plan-leave']))

    const result = await ctx.commands.execute(agent, '/plan', [], new AbortController().signal)
    expect(result?.result).toEqual({
      kind: 'success',
      text: 'Plan mode on. Active on your next prompt.',
    })
    expect(agent.session.snapshotEvents().some(event => event.type === GROK_PLAN_EVENT)).toBe(true)

    await preStep(ctx, agent)
    const last = [...agent.session.snapshotEvents()].reverse().find(event => event.type === GROK_PLAN_EVENT)
    expect(last?.data).toMatchObject({ state: 'Active', active: true })
    expect(last?.type).toBe('plan/mode')
    const notices = agent.session.snapshotEvents()
      .flatMap(event => {
        const text = pluginNoticeText(event.type, event.data)
        return text === undefined ? [] : [text]
      })
    expect(notices.some(text => text.includes('Plan mode is active'))).toBe(true)
  })

  it('treats /plan off as leave, not a planning prompt', async () => {
    const ctx = await setup()
    const agent = await agentWithSession(ctx)
    await ctx.commands.execute(agent, '/plan', [], new AbortController().signal)
    const result = await ctx.commands.execute(agent, '/plan off', [], new AbortController().signal)
    expect(result?.result).toEqual({
      kind: 'success',
      text: 'Left plan mode.',
    })
    const last = [...agent.session.snapshotEvents()].reverse().find(event => event.type === GROK_PLAN_EVENT)
    expect(last?.data).toMatchObject({ state: 'Inactive' })
  })

  it('rejects non-plan-file edits while Active and allows bash', async () => {
    const ctx = await setup()
    ctx.tools.register(defineContentToolFixture({
      name: 'write',
      description: 'write',
      parameters: { file_path: { type: 'string' } },
      execute: () => Promise.resolve([{ type: 'text', text: 'wrote' }]),
    }))
    ctx.tools.register(defineContentToolFixture({
      name: 'bash',
      description: 'bash',
      parameters: { command: { type: 'string' } },
      execute: () => Promise.resolve([{ type: 'text', text: 'ran' }]),
    }))
    const agent = await agentWithSession(ctx)
    await exec(ctx, ENTER_PLAN_MODE, {}, agent)

    const denied = await exec(ctx, 'write', { file_path: '/tmp/live-dsh-workspace/src/main.ts' }, agent)
    expect(denied.isError).toBe(true)
    expect(denied.content.some(block => block.type === 'text' && block.text.includes('file edits are not allowed'))).toBe(true)

    const last = [...agent.session.snapshotEvents()].reverse().find(event => event.type === GROK_PLAN_EVENT)
    const planPath = typeof last?.data === 'object' && last.data !== null && 'plan_file_path' in last.data
      ? String(last.data.plan_file_path)
      : ''
    const allowed = await exec(ctx, 'write', { file_path: planPath }, agent)
    expect(allowed.isError).toBe(false)

    const bash = await exec(ctx, 'bash', { command: 'echo hi > /tmp/f' }, agent)
    expect(bash.isError).toBe(false)
  })

  it('enter_plan_mode seeds plan.md; exit_plan_mode fails closed without a client', async () => {
    const ctx = await setup()
    const agent = await agentWithSession(ctx)
    const entered = await exec(ctx, ENTER_PLAN_MODE, {}, agent)
    expect(entered.isError).toBe(false)
    const text = entered.content.map(block => block.type === 'text' ? block.text : '').join('')
    expect(text).toMatch(/entered plan mode/)
    expect(text).toMatch(/plan\.md/)

    const exited = await exec(ctx, EXIT_PLAN_MODE, {}, agent)
    expect(exited.isError).toBe(true)
    expect(exited.content.map(block => block.type === 'text' ? block.text : '').join(''))
      .toMatch(/no interactive client|stay in plan mode/)
  })

  it('exit_plan_mode presents review and leaves on Approve', async () => {
    const ctx = await setup()
    ctx.on('user-questions/request', () => Promise.resolve({
      answers: [{ id: 'grok-plan-review', selected: [APPROVE_LABEL] }],
    }))
    const agent = await agentWithSession(ctx)
    await exec(ctx, ENTER_PLAN_MODE, {}, agent)
    const exited = await exec(ctx, EXIT_PLAN_MODE, {}, agent)
    expect(exited.isError).toBe(false)
    const text = exited.content.map(block => block.type === 'text' ? block.text : '').join('')
    expect(text).toMatch(/approved|proceed/i)
    const last = [...agent.session.snapshotEvents()].reverse().find(event => event.type === GROK_PLAN_EVENT)
    expect(last?.data).toMatchObject({ state: 'Inactive', awaiting_plan_approval: false })
  })

  it('exit_plan_mode stays in plan when Request changes includes notes', async () => {
    const ctx = await setup()
    ctx.on('user-questions/request', (request) => {
      expect(request.questions[0]?.multiSelect).toBe(true)
      return Promise.resolve({
        answers: [{
          id: 'grok-plan-review',
          selected: [REQUEST_CHANGES_LABEL],
          custom: 'need more detail on tests',
        }],
      })
    })
    const agent = await agentWithSession(ctx)
    await exec(ctx, ENTER_PLAN_MODE, {}, agent)
    const exited = await exec(ctx, EXIT_PLAN_MODE, {}, agent)
    expect(exited.isError).toBe(true)
    expect(exited.content.map(block => block.type === 'text' ? block.text : '').join(''))
      .toMatch(/need more detail on tests/)
    const last = [...agent.session.snapshotEvents()].reverse().find(event => event.type === GROK_PLAN_EVENT)
    expect(last?.data).toMatchObject({ state: 'Active', awaiting_plan_approval: false })
  })

  it('rejects a late approval after /plan off instead of authorizing implementation', async () => {
    const ctx = await setup()
    const agent = await agentWithSession(ctx, 'late-approval')
    ctx.on('user-questions/request', async () => {
      const left = await ctx.commands.execute(agent, '/plan off', [], new AbortController().signal)
      expect(left?.result.kind).toBe('success')
      return { answers: [{ id: 'grok-plan-review', selected: [APPROVE_LABEL] }] }
    })
    await exec(ctx, ENTER_PLAN_MODE, {}, agent)
    const result = await exec(ctx, EXIT_PLAN_MODE, {}, agent)
    expect(result.isError).toBe(true)
  })

  it('rejects contradictory multi-select approval instead of trusting the first label', async () => {
    const ctx = await setup()
    const agent = await agentWithSession(ctx, 'ambiguous-approval')
    ctx.on('user-questions/request', async () => ({
      answers: [{ id: 'grok-plan-review', selected: [APPROVE_LABEL, REQUEST_CHANGES_LABEL] }],
    }))
    await exec(ctx, ENTER_PLAN_MODE, {}, agent)
    const result = await exec(ctx, EXIT_PLAN_MODE, {}, agent)
    expect(result.isError).toBe(true)
    expect(ctx.sessionProjections.stateOf(agent.session, 'grok-plan'))
      .toMatchObject({ state: 'Active', awaiting_plan_approval: false })
  })
})
