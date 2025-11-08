#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import chalk from 'chalk'
import { Command } from 'commander'
import { loginFlow, logoutFlow, whoAmI } from './auth.js'
import { validateCommand, validateWatch } from './validate.js'

const program = new Command()

// Get package version
const __dirname = dirname(fileURLToPath(import.meta.url))
// Try both paths: ../package.json (when running from src) and ../../package.json (when running from dist)
let packageJson: { version: string }
try {
	packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'))
} catch {
	packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'))
}

program.name('guideai').description('CLI for GuideAI').version(packageJson.version)

// Authentication commands
program
  .command('login')
  .description('Authenticate with GuideAI server')
  .option('--server <url>', 'Server URL', 'https://be.guideai.dev')
  .action(async options => {
    try {
      await loginFlow(options.server)
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

program
  .command('logout')
  .description('Remove stored credentials')
  .action(async () => {
    try {
      await logoutFlow()
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

program
  .command('whoami')
  .description('Show current authenticated user')
  .action(async () => {
    try {
      await whoAmI()
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

// Validation command
program
  .command('validate <path>')
  .description('Validate canonical JSONL files')
  .option('--strict', 'Treat warnings as errors')
  .option('--json', 'Output JSON format')
  .option('--verbose', 'Show detailed error information')
  .option('--watch', 'Watch for file changes and re-validate')
  .option('--provider <name>', 'Filter by provider name (e.g., "cursor", "claude", "gemini")')
  .action(async (path, options) => {
    try {
      if (options.watch) {
        await validateWatch(path, options)
      } else {
        await validateCommand(path, options)
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

// Show help if no arguments provided
if (process.argv.length === 2) {
  program.help()
}

// Parse command line arguments
program.parse()
