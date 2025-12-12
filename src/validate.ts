/**
 * Validate Command
 *
 * Validates canonical JSONL files for correctness.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import {
  type JSONLValidationResult,
  generateValidationReport,
  validateJSONL,
} from '@guidemode/session-processing/validation'
import chalk from 'chalk'

interface ValidateOptions {
  strict?: boolean
  json?: boolean
  verbose?: boolean
  watch?: boolean
  provider?: string
}

/**
 * Find all JSONL files in a directory
 */
function findJSONLFiles(path: string): string[] {
  const files: string[] = []

  try {
    const stat = statSync(path)

    if (stat.isFile()) {
      if (extname(path) === '.jsonl') {
        files.push(path)
      }
      return files
    }

    if (stat.isDirectory()) {
      const entries = readdirSync(path)
      for (const entry of entries) {
        const fullPath = join(path, entry)
        files.push(...findJSONLFiles(fullPath))
      }
    }
  } catch (error) {
    console.error(
      chalk.red('Error reading path:'),
      error instanceof Error ? error.message : String(error)
    )
  }

  return files
}

/**
 * Validate a single JSONL file
 */
function validateFile(filePath: string, options: ValidateOptions): JSONLValidationResult {
  if (!options.json) {
    console.log(chalk.cyan(`\nValidating: ${filePath}`))
  }

  try {
    // Read file content
    const content = readFileSync(filePath, 'utf-8')

    // Validate JSONL content
    const result = validateJSONL(content, {
      skipInvalidJSON: !options.strict,
      includeWarnings: true,
    })

    return result
  } catch (error) {
    console.error(
      chalk.red('Validation error:'),
      error instanceof Error ? error.message : String(error)
    )
    process.exit(1)
  }
}

/**
 * Validate command implementation
 */
export async function validateCommand(path: string, options: ValidateOptions): Promise<void> {
  // Only show headers if not in JSON mode
  if (!options.json) {
    console.log(chalk.bold('GuideMode Canonical JSONL Validator'))
    console.log(chalk.gray('─'.repeat(50)))
  }

  // Find all JSONL files
  const files = findJSONLFiles(path)

  if (files.length === 0) {
    if (!options.json) {
      console.log(chalk.yellow('No JSONL files found'))
    }
    return
  }

  if (!options.json) {
    console.log(chalk.cyan(`Found ${files.length} JSONL file(s)`))
  }

  // Filter by provider if specified
  const filesToValidate = options.provider
    ? files.filter(f => f.includes(`/${options.provider}/`))
    : files

  if (filesToValidate.length === 0) {
    if (!options.json) {
      console.log(chalk.yellow(`No files found for provider: ${options.provider}`))
    }
    return
  }

  if (options.provider && !options.json) {
    console.log(
      chalk.cyan(`Filtering for provider "${options.provider}": ${filesToValidate.length} file(s)`)
    )
  }

  // Validate each file
  const results: Array<{
    file: string
    result: JSONLValidationResult
  }> = []

  for (const file of filesToValidate) {
    const result = validateFile(file, options)
    results.push({ file, result })
  }

  // Generate reports
  if (options.json) {
    // JSON output
    const jsonOutput = results.map(r => ({
      file: r.file,
      valid: r.result.valid,
      totalLines: r.result.totalLines,
      validMessages: r.result.validMessages,
      errors: r.result.errors,
      warnings: r.result.sessionResult?.warnings || [],
      sessionId: r.result.sessionResult?.sessionId,
      provider: r.result.sessionResult?.provider,
    }))
    console.log(JSON.stringify(jsonOutput, null, 2))
  } else {
    // Human-readable output
    for (const { file, result } of results) {
      console.log(chalk.gray(`\n${'─'.repeat(50)}`))
      console.log(chalk.bold(`File: ${file}`))
      console.log(
        generateValidationReport(result, {
          verbose: options.verbose,
          colorize: true,
        })
      )
    }

    // Summary
    console.log(chalk.gray(`\n${'='.repeat(50)}`))
    console.log(chalk.bold('Summary'))
    console.log(chalk.gray('─'.repeat(50)))

    const totalFiles = results.length
    const validFiles = results.filter(r => r.result.valid).length
    const invalidFiles = totalFiles - validFiles
    const totalMessages = results.reduce((sum, r) => sum + r.result.parsedLines, 0)
    const validMessages = results.reduce((sum, r) => sum + r.result.validMessages, 0)
    const totalErrors = results.reduce((sum, r) => sum + r.result.errors.length, 0)
    const totalWarnings = results.reduce(
      (sum, r) => sum + (r.result.sessionResult?.warnings.length || 0),
      0
    )

    console.log(`Total Files: ${totalFiles}`)
    console.log(
      `Valid Files: ${chalk.green(validFiles)} / Invalid: ${invalidFiles > 0 ? chalk.red(invalidFiles) : invalidFiles}`
    )
    console.log(`Total Messages: ${totalMessages} / Valid: ${chalk.green(validMessages)}`)
    console.log(`Total Errors: ${totalErrors > 0 ? chalk.red(totalErrors) : totalErrors}`)
    console.log(
      `Total Warnings: ${totalWarnings > 0 ? chalk.yellow(totalWarnings) : totalWarnings}`
    )

    console.log(chalk.gray('─'.repeat(50)))

    if (invalidFiles === 0 && totalErrors === 0) {
      console.log(chalk.green(chalk.bold('\n✓ All validations passed!')))
    } else {
      console.log(
        chalk.red(
          chalk.bold(
            `\n✗ Validation failed with ${totalErrors} error(s) across ${invalidFiles} file(s)`
          )
        )
      )
    }
  }

  // Exit code
  const hasErrors = results.some(r => !r.result.valid)
  const hasWarnings = results.some(
    r => r.result.sessionResult && r.result.sessionResult.warnings.length > 0
  )

  if (hasErrors || (options.strict && hasWarnings)) {
    process.exit(1)
  }
}

/**
 * Watch mode implementation
 */
export async function validateWatch(_path: string, _options: ValidateOptions): Promise<void> {
  console.log(chalk.cyan('Watch mode not yet implemented'))
  console.log(chalk.gray('Use --help for available options'))
  process.exit(1)

  // TODO: Implement watch mode with chokidar
  // import { watch } from 'chokidar'
  // const watcher = watch(path, { ignoreInitial: false })
  // watcher.on('change', async (filePath) => {
  //   if (extname(filePath) === '.jsonl') {
  //     await validateFile(filePath, options)
  //   }
  // })
}
