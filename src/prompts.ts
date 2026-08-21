import type { EnterPlanModeToolHints, PlanFileSeedStatus } from './types.ts'
import { DEFAULT_TOOL_HINTS } from './types.ts'

export const ENTERED_PLAN_MODE_MESSAGE =
  'You have entered plan mode. You should now focus on exploring the codebase and creating an implementation plan.'

export const EXIT_PLAN_APPROVED_MESSAGE =
  'Your plan has been approved. You can now start coding.'

export const EXIT_EMPTY_PLAN_MESSAGE =
  'Plan mode exit approved. No plan content was found — you can proceed.'

export function formatEnterPlanMode(input: {
  message?: string
  planFilePath: string
  planFileSeed: PlanFileSeedStatus
  toolHints?: Partial<EnterPlanModeToolHints>
}): string {
  const hints: EnterPlanModeToolHints = { ...DEFAULT_TOOL_HINTS, ...input.toolHints }
  const ask = hints.ask_user
  const exit = hints.exit_plan
  const taskHint = hints.task === ''
    ? ''
    : `\n   You can use the ${hints.task} tool with subagent_type="explore" to parallelize codebase exploration without filling your context window.`
  const planStatus = formatPlanSeedStatus(input.planFilePath, input.planFileSeed)
  const message = input.message ?? ENTERED_PLAN_MODE_MESSAGE
  return `${message}

${planStatus}

In plan mode, you should:
1. Thoroughly explore the codebase to understand existing patterns${taskHint}
2. Identify similar features, codebase architecture, and understand trade-offs
3. Use ${ask} if you need to clarify the approach
4. Design a concrete implementation strategy
5. Write your plan to the plan file above
6. When ready, use ${exit} to present your plan to the user.`
}

export function formatExitPlanReady(input: {
  message?: string
  planFilePath: string
  planContent: string
}): string {
  const message = input.message ?? EXIT_PLAN_APPROVED_MESSAGE
  return `${message}\n\nYour plan has been saved at: ${input.planFilePath}\n\n## Plan:\n${input.planContent}`
}

export function formatPlanSeedStatus(planFilePath: string, seed: PlanFileSeedStatus): string {
  if (seed.kind === 'empty') {
    return `Write your plan to ${planFilePath}. The file exists and is empty.`
  }
  if (seed.kind === 'non_empty') {
    return `Write your plan to ${planFilePath}. The file exists but is not empty.`
  }
  const detail = {
    not_created: 'The file has not yet been created.',
    not_a_file: 'A directory already exists at that path.',
    inaccessible: 'The file could not be accessed.',
    unavailable: 'The plan file location is unavailable.',
  }[seed.reason]
  return `Write your plan to ${planFilePath}. ${detail}`
}

export const ENTER_PLAN_MODE_DESCRIPTION =
  'Use this tool when a task has ambiguity about the right approach or when the user asks you to write a plan. This tool enables a read-only plan mode where you explore the codebase and create an implementation plan for the user.'

export const EXIT_PLAN_MODE_DESCRIPTION =
  'Exit plan mode and present your plan to the user.\n\nUse this after you have finished writing your plan to the plan file in plan mode.'
