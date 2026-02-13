import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import chalk from 'chalk'
import { DEFAULT_SYNC_HOOKS, loadConfig } from './config.js'
import { loginFlow } from './auth.js'
import { runStatus } from './status.js'
import { brandTitle } from './utils/brand.js'

const HOOKS_CONFIG = {
  hooks: {
    Stop: [{ type: 'command', command: 'guidemode sync', timeout: 60 }],
    PreCompact: [{ type: 'command', command: 'guidemode sync', timeout: 60 }],
    SessionEnd: [{ type: 'command', command: 'guidemode sync', timeout: 60 }],
  },
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function detectHooksTarget(): Promise<string> {
  // Check if .claude/ exists in cwd (local project)
  const localClaudeDir = join(process.cwd(), '.claude')
  if (await fileExists(localClaudeDir)) {
    return join(localClaudeDir, 'settings.local.json')
  }

  // Default to global
  return join(homedir(), '.claude', 'settings.local.json')
}

async function installHooks(targetPath: string): Promise<void> {
  const targetDir = join(targetPath, '..')
  await mkdir(targetDir, { recursive: true })

  // Read existing settings if present
  let settings: Record<string, unknown> = {}
  try {
    const content = await readFile(targetPath, 'utf-8')
    settings = JSON.parse(content)
  } catch {
    // No existing settings file
  }

  // Merge hooks into settings
  const existingHooks = (settings.hooks || {}) as Record<string, unknown[]>
  const newHooks = { ...existingHooks }

  for (const [event, hooks] of Object.entries(HOOKS_CONFIG.hooks)) {
    const existing = (existingHooks[event] || []) as Array<{ command?: string }>
    // Check if guidemode sync is already installed
    const alreadyInstalled = existing.some(
      h => h.command?.includes('guidemode sync')
    )
    if (!alreadyInstalled) {
      newHooks[event] = [...existing, ...hooks]
    }
  }

  settings.hooks = newHooks
  await writeFile(targetPath, JSON.stringify(settings, null, 2), { mode: 0o600 })
}

export interface SetupOptions {
  server?: string
  force?: boolean
}

export async function runSetup(options?: SetupOptions): Promise<void> {
  const serverUrl = options?.server || 'https://app.guidemode.dev'

  console.log(brandTitle(chalk.bold('GuideMode Setup\n')))

  // Step 1: Check if already logged in
  const config = await loadConfig()
  if (config.apiKey && !options?.force) {
    const username = config.username || config.name || 'Unknown'
    console.log(chalk.green(`✓ Already logged in as ${username}`))
    if (config.tenantName) {
      console.log(chalk.gray(`  Tenant: ${config.tenantName}`))
    }
    console.log(chalk.gray('  Use --force to re-authenticate\n'))
  } else {
    // Step 2: Run login flow
    console.log(brandTitle(chalk.bold('Step 1: Authentication\n')))
    await loginFlow(serverUrl)
    console.log()
  }

  // Step 3: Install Claude Code hooks
  console.log(brandTitle(chalk.bold('Step 2: Install Claude Code hooks\n')))
  const targetPath = await detectHooksTarget()
  console.log(chalk.gray(`  Target: ${targetPath}`))

  try {
    await installHooks(targetPath)
    const hookEvents = DEFAULT_SYNC_HOOKS.join(', ')
    console.log(chalk.green(`✓ Hooks installed for: ${hookEvents}`))
  } catch (err) {
    console.error(
      chalk.red('✗ Failed to install hooks:'),
      err instanceof Error ? err.message : String(err)
    )
    console.log(chalk.gray('  You can manually add hooks to your Claude Code settings.'))
  }

  // Step 4: Verify
  console.log(brandTitle(chalk.bold('Step 3: Verification\n')))
  await runStatus({ verbose: true })
}
