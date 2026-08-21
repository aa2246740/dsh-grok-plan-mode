/**
 * Live DSH package test: mounts the real plugin beside real RC8 services.
 * Run from a Harness checkout so @deepseek-ai/* resolve through tsconfig paths:
 *
 *   DSHX_HARNESS=/path/to/deepseek-harness \
 *     pnpm --dir "$DSHX_HARNESS" exec vitest run \
 *     --config my-plugins/dsh-grok-plan-mode/vitest.live.config.ts
 */
import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage, CallId } from '@deepseek-ai/dsh-llm'
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
    agents.enter(agent)
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

let calls = 0
function exec(ctx: Context, name: string, args: unknown, agent?: Agent) {
  return ctx.tools.execute({
    callId: CallId(`live-${++calls}`),
    name,
    arguments: args,
    signal: new AbortController().signal,
    ...agent ? { agent } : {},
  })
}

describe('live DSH: grok-plan-mode', () => {
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
    expect(agent.session.events.some(event => event.type === GROK_PLAN_EVENT)).toBe(true)

    await preStep(ctx, agent)
    const last = [...agent.session.events].reverse().find(event => event.type === GROK_PLAN_EVENT)
    expect(last?.data).toMatchObject({ state: 'Active' })
    const notices = agent.session.events
      .filter(event => event.type === 'user/message' && event.data.source.kind === 'plugin')
      .map(event => event.data.content.map(block => 'text' in block ? block.text : '').join(''))
    expect(notices.some(text => text.includes('Plan mode is active'))).toBe(true)
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

    const last = [...agent.session.events].reverse().find(event => event.type === GROK_PLAN_EVENT)
    const planPath = (last?.data as { plan_file_path: string }).plan_file_path
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
    ctx.userQuestions.registerProvider({
      ask: () => Promise.resolve({
        answers: [{ id: 'grok-plan-review', selected: [APPROVE_LABEL] }],
      }),
    })
    const agent = await agentWithSession(ctx)
    await exec(ctx, ENTER_PLAN_MODE, {}, agent)
    const exited = await exec(ctx, EXIT_PLAN_MODE, {}, agent)
    expect(exited.isError).toBe(false)
    const text = exited.content.map(block => block.type === 'text' ? block.text : '').join('')
    expect(text).toMatch(/approved|proceed/i)
    const last = [...agent.session.events].reverse().find(event => event.type === GROK_PLAN_EVENT)
    expect(last?.data).toMatchObject({ state: 'Inactive', awaiting_plan_approval: false })
  })

  it('exit_plan_mode stays in plan when Request changes includes notes', async () => {
    const ctx = await setup()
    ctx.userQuestions.registerProvider({
      ask: (request) => {
        expect(request.questions[0]?.multiSelect).toBe(true)
        return Promise.resolve({
          answers: [{
            id: 'grok-plan-review',
            selected: [REQUEST_CHANGES_LABEL],
            custom: 'need more detail on tests',
          }],
        })
      },
    })
    const agent = await agentWithSession(ctx)
    await exec(ctx, ENTER_PLAN_MODE, {}, agent)
    const exited = await exec(ctx, EXIT_PLAN_MODE, {}, agent)
    expect(exited.isError).toBe(true)
    expect(exited.content.map(block => block.type === 'text' ? block.text : '').join(''))
      .toMatch(/need more detail on tests/)
    const last = [...agent.session.events].reverse().find(event => event.type === GROK_PLAN_EVENT)
    expect(last?.data).toMatchObject({ state: 'Active', awaiting_plan_approval: false })
  })
})
