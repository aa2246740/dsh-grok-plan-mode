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

/** Grok: session dir `plan.md` first; cwd `.grok/plan.md` if no session path. */
export function resolvePlanFilePath(input: {
  sessionId: string
  cwd?: string
  home?: string
}): { sessionDir: string; planFilePath: string; fallbackPath: string } {
  const dir = sessionDir(input)
  return {
    sessionDir: dir,
    planFilePath: join(dir, 'plan.md'),
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
