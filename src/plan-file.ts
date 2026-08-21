import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { PlanFileSeedFailure, PlanFileSeedStatus } from './types.ts'

export function dshHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.DSH_HOME && env.DSH_HOME.trim() !== ''
    ? env.DSH_HOME
    : join(homedir(), '.dsh')
}

export function encodeCwd(cwd: string): string {
  return encodeURIComponent(cwd)
}

export function sessionDir(input: {
  sessionId: string
  cwd?: string
  home?: string
}): string {
  const home = input.home ?? dshHome()
  const cwdKey = input.cwd && input.cwd.trim() !== '' ? encodeCwd(input.cwd) : '_no_cwd'
  return join(home, 'sessions', cwdKey, input.sessionId)
}

export function fallbackPlanPath(cwd: string | undefined): string {
  if (cwd === undefined || cwd.trim() === '') return '.dsh/plan.md'
  return join(cwd, '.dsh', 'plan.md')
}

/**
 * Workspace-owned per-session plan file.
 *
 * Grok writes `plan.md` in the session directory because that directory is
 * already agent-writable. DSH `workspace-write` only allows the project cwd,
 * so `~/.dsh/sessions/.../plan.md` needs a sandbox escalation (and a user
 * click). Plan mode is not a privilege bump — it is a tighter edit gate —
 * so the designated file lives under the workspace instead.
 */
export function workspacePlanFilePath(cwd: string | undefined, sessionId: string): string | undefined {
  if (cwd === undefined || cwd.trim() === '') return undefined
  return join(cwd, '.dsh', 'plans', sessionId, 'plan.md')
}

/**
 * Grok: session dir `plan.md` first; cwd `.grok/plan.md` if no session path.
 * DSH: workspace `$cwd/.dsh/plans/<id>/plan.md` first so Workspace Write can
 * persist the plan without asking; session dir keeps `plan_mode.json` and a
 * leftover `plan.md` alias.
 */
export function resolvePlanFilePath(input: {
  sessionId: string
  cwd?: string
  home?: string
}): {
  sessionDir: string
  planFilePath: string
  sessionPlanPath: string
  fallbackPath: string
} {
  const dir = sessionDir(input)
  const sessionPlanPath = join(dir, 'plan.md')
  return {
    sessionDir: dir,
    planFilePath: workspacePlanFilePath(input.cwd, input.sessionId) ?? sessionPlanPath,
    sessionPlanPath,
    fallbackPath: fallbackPlanPath(input.cwd),
  }
}

export async function planFileHasContent(path: string): Promise<boolean> {
  try {
    const info = await stat(path)
    return info.isFile() && info.size > 0
  } catch {
    return false
  }
}

export async function readPlanFile(path: string): Promise<string | undefined> {
  try {
    const text = await readFile(path, 'utf8')
    return text.trim() === '' ? undefined : text
  } catch {
    return undefined
  }
}

/**
 * Probe the plan file; create an empty one only on not-found.
 * Never truncates existing content.
 */
export async function probeOrCreateEmptyPlanFile(path: string): Promise<PlanFileSeedStatus> {
  try {
    const bytes = await readFile(path)
    return bytes.length === 0 ? { kind: 'empty' } : { kind: 'non_empty' }
  } catch (error) {
    const failure = seedFailureFromReadError(error)
    if (failure !== undefined) return { kind: 'missing', reason: failure }
    try {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, '', { flag: 'wx' })
      return { kind: 'empty' }
    } catch (writeError) {
      if (isAlreadyExists(writeError)) {
        try {
          const bytes = await readFile(path)
          return bytes.length === 0 ? { kind: 'empty' } : { kind: 'non_empty' }
        } catch {
          return { kind: 'missing', reason: 'inaccessible' }
        }
      }
      return { kind: 'missing', reason: 'not_created' }
    }
  }
}

/**
 * If an older session left content only in `~/.dsh/sessions/.../plan.md`,
 * copy it once into the workspace plan file. Never overwrite a nonempty dest.
 */
export async function adoptLegacyPlanFile(from: string, to: string): Promise<void> {
  if (normalizeLoose(from) === normalizeLoose(to)) return
  if (await planFileHasContent(to)) return
  const text = await readPlanFile(from)
  if (text === undefined) return
  await mkdir(dirname(to), { recursive: true })
  try {
    await writeFile(to, text, { flag: 'wx' })
  } catch (error) {
    if (!isAlreadyExists(error)) throw error
  }
}

function normalizeLoose(value: string): string {
  return value.replace(/\\/g, '/')
}

export async function writePlanModeJson(sessionDirectory: string, json: unknown): Promise<void> {
  await mkdir(sessionDirectory, { recursive: true })
  await writeFile(join(sessionDirectory, 'plan_mode.json'), `${JSON.stringify(json, null, 2)}\n`)
}

export async function readPlanModeJson(sessionDirectory: string): Promise<unknown> {
  const text = await readFile(join(sessionDirectory, 'plan_mode.json'), 'utf8')
  return JSON.parse(text) as unknown
}

function seedFailureFromReadError(error: unknown): PlanFileSeedFailure | undefined {
  const code = errorCode(error)
  if (code === 'ENOENT') return undefined
  if (code === 'EISDIR') return 'not_a_file'
  if (code === 'EACCES' || code === 'EPERM') return 'inaccessible'
  if (code !== undefined) return 'inaccessible'
  return 'inaccessible'
}

function isAlreadyExists(error: unknown): boolean {
  return errorCode(error) === 'EEXIST'
}

function errorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}
