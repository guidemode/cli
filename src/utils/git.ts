import { execFile as execFileCb } from 'node:child_process'
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFile = promisify(execFileCb)
const GIT_TIMEOUT = 5000

export interface GitMetadata {
  remoteUrl: string | null
  branch: string | null
  commitHash: string | null
  repoName: string
}

async function gitCommand(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFile('git', args, { cwd, timeout: GIT_TIMEOUT })
  return stdout.trim()
}

export function normalizeGitUrl(url: string): string {
  if (url.startsWith('git@github.com:')) {
    return `https://github.com/${url.slice('git@github.com:'.length)}`
  }
  if (url.startsWith('ssh://git@github.com/')) {
    return `https://github.com/${url.slice('ssh://git@github.com/'.length)}`
  }
  return url
}

export function extractRepoName(url: string): string {
  const match = url.match(/[:/]([^/]+\/[^/.]+?)(?:\.git)?$/)
  return match ? match[1] : ''
}

export async function detectProjectType(cwd: string): Promise<string> {
  const checks: [string, string][] = [
    ['package.json', 'nodejs'],
    ['Cargo.toml', 'rust'],
    ['go.mod', 'go'],
    ['requirements.txt', 'python'],
    ['pyproject.toml', 'python'],
    ['setup.py', 'python'],
  ]

  for (const [file, type] of checks) {
    try {
      await access(join(cwd, file))
      return type
    } catch {
      // File doesn't exist, continue
    }
  }

  return 'generic'
}

export async function getGitMetadata(cwd: string): Promise<GitMetadata> {
  const fallback: GitMetadata = {
    remoteUrl: null,
    branch: null,
    commitHash: null,
    repoName: 'unknown',
  }

  if (!cwd) return fallback

  try {
    let remoteUrl: string | null = null
    try {
      const raw = await gitCommand(['remote', 'get-url', 'origin'], cwd)
      remoteUrl = normalizeGitUrl(raw)
    } catch {
      // No git remote
    }

    let branch: string | null = null
    try {
      branch = await gitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)
    } catch {
      // Not in a git repo
    }

    let commitHash: string | null = null
    try {
      commitHash = await gitCommand(['rev-parse', 'HEAD'], cwd)
    } catch {
      // Not in a git repo
    }

    let repoName = 'unknown'
    if (remoteUrl) {
      const extracted = extractRepoName(remoteUrl)
      if (extracted) repoName = extracted
    }
    if (repoName === 'unknown' && cwd) {
      const { basename } = await import('node:path')
      repoName = basename(cwd)
    }

    return { remoteUrl, branch, commitHash, repoName }
  } catch {
    return fallback
  }
}
