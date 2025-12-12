import chalk from 'chalk'
import { getApiKey, getServerUrl } from './config.js'

export interface DeployOptions {
  ref: string
  sha: string
  env: 'production' | 'staging' | 'development' | 'qa' | 'preview' | 'other'
  status: 'pending' | 'queued' | 'in_progress' | 'success' | 'failure' | 'error' | 'inactive'
  repository: string
  externalId?: string
  description?: string
  url?: string
  rollback?: boolean
  rollbackFrom?: string
  json?: boolean
}

interface DeploymentResponse {
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
 * Create or update a deployment via the GuideMode API
 */
export async function createDeployment(options: DeployOptions): Promise<void> {
  const apiKey = await getApiKey()
  if (!apiKey) {
    console.error(chalk.red('✗ Not authenticated'))
    console.log(chalk.gray('Run "guidemode login" to authenticate first'))
    process.exit(1)
  }

  const serverUrl = await getServerUrl()

  // Validate SHA length (allow short SHAs of 7+ characters or full 40 character SHAs)
  if (options.sha.length < 7 || options.sha.length > 40) {
    console.error(chalk.red('✗ Invalid SHA: must be 7-40 characters'))
    console.log(chalk.gray(`  Received: ${options.sha} (${options.sha.length} characters)`))
    process.exit(1)
  }

  // Generate external ID if not provided
  const externalId = options.externalId || `manual-deploy-${crypto.randomUUID()}`

  const payload = {
    repositoryKey: options.repository,
    externalId,
    ref: options.ref,
    sha: options.sha,
    environment: options.env,
    status: options.status,
    description: options.description,
    url: options.url,
    isRollback: options.rollback,
    rollbackFromSha: options.rollbackFrom,
  }

  try {
    const response = await fetch(`${serverUrl}/api/webhooks/v1/deployments`, {
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
        console.log(
          chalk.gray('Your API key may have expired. Run "guidemode login" to re-authenticate')
        )
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

    const result = (await response.json()) as DeploymentResponse

    if (options.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      const actionVerb = result.action === 'created' ? 'Created' : 'Updated'
      const deployType = options.rollback ? 'rollback' : 'deployment'
      console.log(chalk.green(`✓ ${actionVerb} ${deployType} successfully`))
      console.log(chalk.gray(`  ID: ${result.id}`))
      console.log(chalk.gray(`  External ID: ${result.externalId}`))
      console.log(chalk.gray(`  Repository: ${options.repository}`))
      console.log(chalk.gray(`  Ref: ${options.ref}`))
      console.log(chalk.gray(`  SHA: ${options.sha.substring(0, 7)}`))
      console.log(chalk.gray(`  Environment: ${options.env}`))
      console.log(chalk.gray(`  Status: ${options.status}`))
      if (options.rollback && options.rollbackFrom) {
        console.log(chalk.gray(`  Rollback from: ${options.rollbackFrom.substring(0, 7)}`))
      }
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
