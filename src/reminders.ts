import type { EnterPlanModeToolHints } from './types.ts'
import { DEFAULT_TOOL_HINTS } from './types.ts'

export function wrapSystemReminder(text: string): string {
  return `<system-reminder>\n${text}\n</system-reminder>`
}

export function planModeReminderFull(input: {
  planPath: string
  planHasContent: boolean
  tools?: Partial<EnterPlanModeToolHints> & { edit?: string }
}): string {
  const edit = input.tools?.edit ?? 'str_replace_editor'
  const ask = input.tools?.ask_user ?? DEFAULT_TOOL_HINTS.ask_user
  const exit = input.tools?.exit_plan ?? DEFAULT_TOOL_HINTS.exit_plan
  const planBlock = input.planHasContent
    ? `A plan file exists at ${input.planPath}. You can read it and make edits using the ${edit} tool.`
    : `No plan written yet. Write your plan to ${input.planPath} using the ${edit} tool.`
  return [
    'Plan mode is active. Do not make any edits or writes to the system.',
    '',
    '## Plan File:',
    planBlock,
    '',
    'You should build your plan by writing to or editing this file. Note that this is the only file you are allowed to edit.',
    '',
    `Your turn should only end with either ${ask} to clarify requirements or ${exit} to present your plan to the user.`,
  ].join('\n')
}

export function planModeReminderSparse(): string {
  return 'Plan mode is still active. Do not make any edits or writes to the system except for the plan file.'
}

export function planModeReentryReminder(input: {
  planPath: string
  tools?: Partial<EnterPlanModeToolHints>
}): string {
  const ask = input.tools?.ask_user ?? DEFAULT_TOOL_HINTS.ask_user
  const exit = input.tools?.exit_plan ?? DEFAULT_TOOL_HINTS.exit_plan
  return [
    '## Returning to Plan Mode',
    '',
    `You are entering plan mode again after having previously exited it. A plan file exists at ${input.planPath} from your previous planning session.`,
    '',
    `Your turn should only end with either ${ask} to clarify requirements or ${exit} to present your plan to the user.`,
  ].join('\n')
}

export function planModeExitReminder(): string {
  return 'You have exited plan mode. You can now make edits, run tools, and take actions.'
}

export function planModeEditRejected(planPath: string): string {
  return `Rejected: file edits are not allowed in plan mode - the only editable file is the plan file (${planPath}).`
}
