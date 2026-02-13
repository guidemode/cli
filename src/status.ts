import { execFile as execFileCb } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { promisify } from 'node:util'
import chalk from 'chalk'
import { CONFIG_FILE, DEFAULT_SYNC_HOOKS, LOG_FILE, loadConfig } from './config.js'
import { PREFIX } from './utils/brand.js'

const execFile = promisify(execFileCb)

interface CheckResult {
  name: string
  passed: boolean
  warning?: string
  detail?: string
}

export interface StatusOptions {
  verbose?: boolean
  json?: boolean
}

async function checkDependencies(): Promise<CheckResult> {
  const missing: string[] = []
  try {
    await execFile('git', ['--version'], { timeout: 5000 })
  } catch {
    missing.push('git')
  }
  if (missing.length > 0) {
    return { name: 'Dependencies', passed: false, detail: `missing: ${missing.join(' ')}` }
  }
  return { name: 'Dependencies', passed: true }
}

async function checkConfig(): Promise<CheckResult & { config?: ReturnType<typeof loadConfig> }> {
  try {
    await stat(CONFIG_FILE)
  } catch {
    return {
      name: 'Config',
      passed: false,
      detail: 'not found — run "guidemode setup" to configure',
    }
  }

  const config = await loadConfig()
  if (!config.serverUrl) {
    return { name: 'Config', passed: false, detail: 'server URL not configured' }
  }
  if (!config.apiKey) {
    return { name: 'Config', passed: false, detail: 'API key not configured' }
  }
  return { name: 'Config', passed: true, config: Promise.resolve(config) }
}

async function checkConnectivity(
  serverUrl: string,
  apiKey: string
): Promise<CheckResult> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    const response = await fetch(`${serverUrl}/auth/session`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (response.ok) {
      return { name: 'Server', passed: true }
    }
    if (response.status === 401 || response.status === 403) {
      return {
        name: 'Server',
        passed: false,
        detail: `API key invalid (HTTP ${response.status})`,
      }
    }
    return { name: 'Server', passed: false, detail: `HTTP ${response.status}` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('abort')) {
      return { name: 'Server', passed: false, detail: `cannot reach ${serverUrl}` }
    }
    return { name: 'Server', passed: false, detail: `cannot reach ${serverUrl}: ${message}` }
  }
}

async function checkLogs(): Promise<CheckResult> {
  try {
    const content = await readFile(LOG_FILE, 'utf-8')
    const lines = content.split('\n').slice(-50)
    const errorCount = lines.filter(l => l.includes('ERROR')).length
    if (errorCount > 0) {
      return { name: 'Logs', passed: true, warning: `${errorCount} recent errors` }
    }
  } catch {
    // No log file, that's fine
  }
  return { name: 'Logs', passed: true }
}

export async function runStatus(options?: StatusOptions): Promise<void> {
  const checks: CheckResult[] = []

  // Check dependencies
  checks.push(await checkDependencies())

  // Check config
  const configCheck = await checkConfig()
  checks.push(configCheck)

  let config = null
  if (configCheck.passed) {
    config = await loadConfig()
  }

  // Check connectivity (only if config is valid)
  if (config?.apiKey && config?.serverUrl) {
    checks.push(await checkConnectivity(config.serverUrl, config.apiKey))
  } else {
    checks.push({ name: 'Server', passed: false, detail: 'cannot test (missing config)' })
  }

  // Check logs
  checks.push(await checkLogs())

  const allOk = checks.every(c => c.passed)

  if (options?.json) {
    const output = {
      ok: allOk,
      checks: checks.map(c => ({
        name: c.name,
        passed: c.passed,
        ...(c.detail && { detail: c.detail }),
        ...(c.warning && { warning: c.warning }),
      })),
      ...(config && {
        user: config.username || config.name,
        tenant: config.tenantName,
        server: config.serverUrl,
        hooks: config.syncHooks || DEFAULT_SYNC_HOOKS,
      }),
    }
    console.log(JSON.stringify(output, null, 2))
    return
  }

  // Print check line
  const symbols = checks.map(c => (c.passed ? chalk.green(`✓ ${c.name}`) : chalk.red(`✗ ${c.name}`)))
  console.log(`${PREFIX} ${symbols.join('  ')}`)

  // Show details if issues found
  if (!allOk) {
    for (const c of checks) {
      if (!c.passed && c.detail) {
        console.log(chalk.red(`  ✗ ${c.name}: ${c.detail}`))
      }
    }
  }

  // Show warnings
  for (const c of checks) {
    if (c.warning) {
      console.log(chalk.yellow(`  ! ${c.name}: ${c.warning}`))
    }
  }

  // Verbose mode
  if (allOk && options?.verbose && config) {
    const username = config.username || config.name || '?'
    const tenant = config.tenantName || '?'
    console.log(`  User: ${username}@${tenant} → ${config.serverUrl}`)
    const hooks = config.syncHooks || DEFAULT_SYNC_HOOKS
    console.log(`  Hooks: ${hooks.join(', ')}`)

    try {
      const content = await readFile(LOG_FILE, 'utf-8')
      const lines = content.split('\n').filter(Boolean)
      const lastUpload = lines
        .filter(l => l.includes('Successfully uploaded') || l.includes('Upload failed') || l.includes('unchanged'))
        .pop()
      if (lastUpload) {
        const stripped = lastUpload.replace(/^.*?\] /, '')
        console.log(`  Last: ${stripped}`)
      }
    } catch {
      // No log file
    }
  }

  // Summary line
  if (allOk) {
    console.log(`${PREFIX} ${chalk.green('✓ ALL OK')} — Sessions are syncing to GuideMode`)
  } else {
    console.log(`${PREFIX} ${chalk.red('✗ ISSUES FOUND')} — See above for details`)
  }
}
