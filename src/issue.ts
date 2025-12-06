import chalk from 'chalk'
import { getApiKey, getServerUrl } from './config.js'

export interface IssueOptions {
  title: string
  type: 'feature' | 'bug' | 'chore' | 'discovery' | 'incident' | 'other'
  state: 'open' | 'closed' | 'in_progress'
  repository: string
  externalId?: string
  body?: string
  url?: string
  labels?: string
  assignee?: string
  closedAt?: string
  json?: boolean
}

interface IssueResponse {
  success: boolean
  action: 'created' | 'updated'
  id: string
  externalId: string
}

interface ErrorResponse {
  error: string
  details?: Array<{ path: string; message: string }>
}

/**
 * Create or update an issue via the GuideMode API
 */
export async function createIssue(options: IssueOptions): Promise<void> {
  const apiKey = await getApiKey()
  if (!apiKey) {
    console.error(chalk.red('✗ Not authenticated'))
    console.log(chalk.gray('Run "guidemode login" to authenticate first'))
    process.exit(1)
  }

  const serverUrl = await getServerUrl()

  // Generate external ID if not provided
  const externalId = options.externalId || `manual-issue-${crypto.randomUUID()}`

  // Parse labels from comma-separated string
  const labels = options.labels ? options.labels.split(',').map(l => l.trim()) : undefined

  const payload = {
    repositoryKey: options.repository,
    externalId,
    title: options.title,
    type: options.type,
    state: options.state,
    body: options.body,
    url: options.url,
    labels,
    assigneeUsername: options.assignee,
    closedAt: options.closedAt,
  }

  try {
    const response = await fetch(`${serverUrl}/api/webhooks/v1/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = (await response.json()) as ErrorResponse

      if (response.status === 401) {
        console.error(chalk.red('✗ Authentication failed'))
        console.log(chalk.gray('Your API key may have expired. Run "guidemode login" to re-authenticate'))
        process.exit(1)
      }

      if (response.status === 400 && errorData.details) {
        console.error(chalk.red('✗ Validation failed:'))
        for (const detail of errorData.details) {
          console.error(chalk.gray(`  ${detail.path}: ${detail.message}`))
        }
        process.exit(1)
      }

      console.error(chalk.red(`✗ Error: ${errorData.error}`))
      process.exit(1)
    }

    const result = (await response.json()) as IssueResponse

    if (options.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      const actionVerb = result.action === 'created' ? 'Created' : 'Updated'
      console.log(chalk.green(`✓ ${actionVerb} issue successfully`))
      console.log(chalk.gray(`  ID: ${result.id}`))
      console.log(chalk.gray(`  External ID: ${result.externalId}`))
      console.log(chalk.gray(`  Repository: ${options.repository}`))
      console.log(chalk.gray(`  Type: ${options.type}`))
      console.log(chalk.gray(`  State: ${options.state}`))
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error(chalk.red('✗ Network error: Could not connect to server'))
      console.log(chalk.gray(`Server URL: ${serverUrl}`))
      process.exit(1)
    }
    throw error
  }
}
