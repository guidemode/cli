#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import chalk from 'chalk'
import { Command } from 'commander'
import { loginFlow, logoutFlow, whoAmI } from './auth.js'
import { createDeployment } from './deploy.js'
import { createIssue } from './issue.js'
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

program.name('guidemode').description('CLI for GuideMode').version(packageJson.version)

// Authentication commands
program
  .command('login')
  .description('Authenticate with GuideMode server')
  .option('--server <url>', 'Server URL', 'https://app.guidemode.dev')
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

// Issue command
program
  .command('issue <title>')
  .description('Create or update an issue in GuideMode')
  .requiredOption('--type <type>', 'Issue type: feature, bug, chore, discovery, incident, other')
  .requiredOption('--state <state>', 'Issue state: open, closed, in_progress')
  .requiredOption('--repository <key>', 'Repository key (e.g., "owner/repo")')
  .option('--external-id <id>', 'Unique external ID (auto-generated if omitted)')
  .option('--body <text>', 'Issue description')
  .option('--url <url>', 'Link to source issue')
  .option('--labels <labels>', 'Comma-separated labels')
  .option('--assignee <username>', 'Assignee username')
  .option('--closed-at <timestamp>', 'ISO8601 timestamp when closed')
  .option('--json', 'Output JSON response')
  .action(async (title, options) => {
    try {
      // Validate type
      const validTypes = ['feature', 'bug', 'chore', 'discovery', 'incident', 'other']
      if (!validTypes.includes(options.type)) {
        console.error(chalk.red(`✗ Invalid type: ${options.type}`))
        console.error(chalk.gray(`  Valid types: ${validTypes.join(', ')}`))
        process.exit(1)
      }

      // Validate state
      const validStates = ['open', 'closed', 'in_progress']
      if (!validStates.includes(options.state)) {
        console.error(chalk.red(`✗ Invalid state: ${options.state}`))
        console.error(chalk.gray(`  Valid states: ${validStates.join(', ')}`))
        process.exit(1)
      }

      await createIssue({
        title,
        type: options.type,
        state: options.state,
        repository: options.repository,
        externalId: options.externalId,
        body: options.body,
        url: options.url,
        labels: options.labels,
        assignee: options.assignee,
        closedAt: options.closedAt,
        json: options.json,
      })
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

// Deploy command
program
  .command('deploy <ref> <sha>')
  .description('Create or update a deployment in GuideMode')
  .requiredOption('--env <environment>', 'Environment: production, staging, development, qa, preview, other')
  .requiredOption('--status <status>', 'Deployment status: pending, queued, in_progress, success, failure, error')
  .requiredOption('--repository <key>', 'Repository key (e.g., "owner/repo")')
  .option('--external-id <id>', 'Unique external ID (auto-generated if omitted)')
  .option('--description <text>', 'Deployment description')
  .option('--url <url>', 'Deployment URL')
  .option('--rollback', 'Flag this as a rollback deployment')
  .option('--rollback-from <sha>', 'SHA being rolled back from')
  .option('--json', 'Output JSON response')
  .action(async (ref, sha, options) => {
    try {
      // Validate environment
      const validEnvs = ['production', 'staging', 'development', 'qa', 'preview', 'other']
      if (!validEnvs.includes(options.env)) {
        console.error(chalk.red(`✗ Invalid environment: ${options.env}`))
        console.error(chalk.gray(`  Valid environments: ${validEnvs.join(', ')}`))
        process.exit(1)
      }

      // Validate status
      const validStatuses = ['pending', 'queued', 'in_progress', 'success', 'failure', 'error', 'inactive']
      if (!validStatuses.includes(options.status)) {
        console.error(chalk.red(`✗ Invalid status: ${options.status}`))
        console.error(chalk.gray(`  Valid statuses: ${validStatuses.join(', ')}`))
        process.exit(1)
      }

      await createDeployment({
        ref,
        sha,
        env: options.env,
        status: options.status,
        repository: options.repository,
        externalId: options.externalId,
        description: options.description,
        url: options.url,
        rollback: options.rollback,
        rollbackFrom: options.rollbackFrom,
        json: options.json,
      })
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
