import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { gzip } from 'node:zlib'
import { promisify } from 'node:util'
import { DEFAULT_SYNC_HOOKS, loadConfig } from './config.js'
import { logToFile } from './utils/logger.js'
import { detectProjectType, getGitMetadata } from './utils/git.js'

const gzipAsync = promisify(gzip)
const FETCH_TIMEOUT = 30_000

interface SyncInput {
  sessionId: string
  transcriptPath: string
  cwd: string
  hookEvent: string
}

function parseStdin(raw: string): SyncInput | null {
  try {
    const d = JSON.parse(raw)
    return {
      sessionId: d.session_id || '',
      transcriptPath: d.transcript_path || '',
      cwd: d.cwd || '',
      hookEvent: d.hook_event_name || '',
    }
  } catch {
    return null
  }
}

function readStdin(): Promise<string> {
  return new Promise(resolve => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => {
      data += chunk
    })
    process.stdin.on('end', () => resolve(data))
    // If stdin is a TTY (not piped), resolve immediately
    if (process.stdin.isTTY) {
      resolve('')
    }
  })
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function triggerProcessing(
  apiKey: string,
  serverUrl: string,
  sessionId: string,
  hookEvent: string
): Promise<void> {
  try {
    const response = await fetchWithTimeout(
      `${serverUrl}/api/session-processing/process/${encodeURIComponent(sessionId)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      }
    )
    if (response.ok) {
      await logToFile('INFO', `[${hookEvent}] Triggered processing for session ${sessionId}`)
    } else {
      const body = await response.text().catch(() => '')
      await logToFile(
        'WARN',
        `[${hookEvent}] Processing trigger returned HTTP ${response.status}: ${body}`
      )
    }
  } catch (err) {
    await logToFile(
      'WARN',
      `[${hookEvent}] Processing trigger failed for session ${sessionId}: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

export interface SyncOptions {
  sessionId?: string
  transcriptPath?: string
  cwd?: string
  hookEvent?: string
}

export async function runSync(options?: SyncOptions): Promise<void> {
  let input: SyncInput | null = null

  if (options?.sessionId && options?.transcriptPath) {
    // CLI arg mode
    input = {
      sessionId: options.sessionId,
      transcriptPath: options.transcriptPath,
      cwd: options.cwd || process.cwd(),
      hookEvent: options.hookEvent || 'Manual',
    }
  } else {
    // Stdin mode (hook invocation)
    const raw = await readStdin()
    if (!raw) {
      await logToFile('ERROR', 'No input received on stdin')
      return
    }
    input = parseStdin(raw)
    if (!input) {
      await logToFile('ERROR', 'Failed to parse stdin JSON')
      return
    }
  }

  if (!input.sessionId || !input.transcriptPath) {
    await logToFile('ERROR', 'Missing session_id or transcript_path in input')
    return
  }

  const hookEvent = input.hookEvent

  // Load config
  const config = await loadConfig()
  if (!config.apiKey || !config.serverUrl) {
    await logToFile('INFO', 'No apiKey or serverUrl in config - skipping upload (run setup first)')
    return
  }

  // Check if this hook event is enabled
  const enabledHooks = config.syncHooks || DEFAULT_SYNC_HOOKS
  if (hookEvent && !enabledHooks.includes(hookEvent) && hookEvent !== 'Manual') {
    await logToFile('INFO', `Hook ${hookEvent} not enabled in syncHooks config - skipping`)
    return
  }

  // Check transcript file exists
  try {
    await stat(input.transcriptPath)
  } catch {
    await logToFile('ERROR', `Transcript file not found: ${input.transcriptPath}`)
    return
  }

  await logToFile(
    'INFO',
    `[${hookEvent}] Processing session ${input.sessionId} from ${input.transcriptPath}`
  )

  const { apiKey, serverUrl } = config

  // Compute SHA256 hash
  const fileContent = await readFile(input.transcriptPath)
  const fileHash = createHash('sha256').update(fileContent).digest('hex')

  // Check hash with server (dedup)
  try {
    const checkUrl = `${serverUrl}/api/agent-sessions/check-hash?sessionId=${encodeURIComponent(input.sessionId)}&fileHash=${fileHash}`
    const checkResponse = await fetchWithTimeout(checkUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (checkResponse.ok) {
      const checkData = (await checkResponse.json()) as { needsUpload?: boolean }
      if (checkData.needsUpload === false) {
        await logToFile(
          'INFO',
          `[${hookEvent}] Session ${input.sessionId} unchanged (hash match) - skipping upload`
        )
        // On SessionEnd, still trigger processing even if upload was skipped
        if (hookEvent === 'SessionEnd') {
          await triggerProcessing(apiKey, serverUrl, input.sessionId, hookEvent)
        }
        return
      }
    } else {
      await logToFile(
        'WARN',
        `Hash check returned ${checkResponse.status} - proceeding with upload`
      )
    }
  } catch (err) {
    await logToFile(
      'ERROR',
      `Hash check request failed: ${err instanceof Error ? err.message : String(err)}`
    )
    return
  }

  // Gzip and base64 encode
  const compressed = await gzipAsync(fileContent)
  const content = compressed.toString('base64')
  const fileSize = fileContent.length

  // Extract git metadata
  const gitMeta = await getGitMetadata(input.cwd)
  const detectedRepoType = await detectProjectType(input.cwd)

  // Build upload payload
  const payload = {
    provider: 'claude-code',
    repositoryName: gitMeta.repoName,
    sessionId: input.sessionId,
    fileName: `${input.sessionId}.jsonl`,
    fileHash,
    content,
    contentEncoding: 'gzip',
    fileSize,
    ...(gitMeta.branch && { gitBranch: gitMeta.branch }),
    ...(gitMeta.commitHash && { latestCommitHash: gitMeta.commitHash }),
    ...(gitMeta.commitHash && { firstCommitHash: gitMeta.commitHash }),
    repositoryMetadata: {
      cwd: input.cwd || '.',
      gitRemoteUrl: gitMeta.remoteUrl,
      detectedRepositoryType: detectedRepoType,
    },
  }

  // Upload to server
  try {
    const uploadResponse = await fetchWithTimeout(
      `${serverUrl}/api/agent-sessions/upload-v2`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    )

    if (uploadResponse.ok) {
      await logToFile(
        'INFO',
        `[${hookEvent}] Successfully uploaded session ${input.sessionId} (HTTP ${uploadResponse.status})`
      )
      // On SessionEnd, trigger server-side processing
      if (hookEvent === 'SessionEnd') {
        await triggerProcessing(apiKey, serverUrl, input.sessionId, hookEvent)
      }
    } else {
      const body = await uploadResponse.text().catch(() => '')
      await logToFile(
        'ERROR',
        `[${hookEvent}] Upload failed with HTTP ${uploadResponse.status}: ${body}`
      )
    }
  } catch (err) {
    await logToFile(
      'ERROR',
      `[${hookEvent}] Upload request failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
