import { readFile, stat, watch } from 'node:fs/promises'
import chalk from 'chalk'
import { LOG_FILE } from './config.js'
import { PREFIX } from './utils/brand.js'

export interface LogsOptions {
  lines?: number
  errors?: boolean
  follow?: boolean
}

function colorizeLine(line: string): string {
  if (line.includes('ERROR')) return chalk.red(line)
  if (line.includes('WARN')) return chalk.yellow(line)
  return line
}

export async function runLogs(options?: LogsOptions): Promise<void> {
  const lineCount = options?.lines ?? 30
  const errorsOnly = options?.errors ?? false

  try {
    await stat(LOG_FILE)
  } catch {
    console.log(chalk.yellow(`${PREFIX} No log file found at:`), LOG_FILE)
    console.log(chalk.gray('Logs will appear after your first sync.'))
    return
  }

  const content = await readFile(LOG_FILE, 'utf-8')
  let lines = content.split('\n').filter(Boolean)

  if (errorsOnly) {
    lines = lines.filter(l => l.includes('ERROR') || l.includes('WARN'))
  }

  const tail = lines.slice(-lineCount)

  if (tail.length === 0) {
    if (errorsOnly) {
      console.log(`${PREFIX} ${chalk.green('No errors or warnings found.')}`)
    } else {
      console.log(chalk.yellow(`${PREFIX} Log file is empty.`))
    }
    return
  }

  for (const line of tail) {
    console.log(colorizeLine(line))
  }

  if (options?.follow) {
    console.log(chalk.gray('\n--- Following log file (Ctrl+C to stop) ---\n'))
    let lastSize = (await stat(LOG_FILE)).size

    try {
      const watcher = watch(LOG_FILE)
      for await (const _event of watcher) {
        try {
          const currentStat = await stat(LOG_FILE)
          if (currentStat.size > lastSize) {
            const fd = await import('node:fs/promises')
            const fh = await fd.open(LOG_FILE, 'r')
            const buf = Buffer.alloc(currentStat.size - lastSize)
            await fh.read(buf, 0, buf.length, lastSize)
            await fh.close()
            const newContent = buf.toString('utf-8')
            const newLines = newContent.split('\n').filter(Boolean)
            for (const line of newLines) {
              if (errorsOnly && !line.includes('ERROR') && !line.includes('WARN')) continue
              console.log(colorizeLine(line))
            }
            lastSize = currentStat.size
          }
        } catch {
          // File might be rotated or deleted - keep watching
        }
      }
    } catch {
      // Watcher error - exit gracefully
    }
  }
}
