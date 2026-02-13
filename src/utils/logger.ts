import { appendFile, mkdir } from 'node:fs/promises'
import { LOG_DIR, LOG_FILE } from '../config.js'

let logDirEnsured = false

async function ensureLogDir(): Promise<void> {
  if (logDirEnsured) return
  try {
    await mkdir(LOG_DIR, { recursive: true, mode: 0o700 })
    logDirEnsured = true
  } catch {
    // Ignore - best effort
  }
}

export async function logToFile(level: string, message: string): Promise<void> {
  try {
    await ensureLogDir()
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    const line = `[${timestamp}] ${level}: ${message}\n`
    await appendFile(LOG_FILE, line, { mode: 0o600 })
  } catch {
    // Never throw - logging must be silent
  }
}
