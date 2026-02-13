import { type Server, createServer } from 'node:http'
import { URL } from 'node:url'
import chalk from 'chalk'
import open from 'open'
import { clearConfig, loadConfig, updateConfig } from './config.js'
import { PREFIX } from './utils/brand.js'

const PORT_RANGE_START = 8765
const PORT_RANGE_END = 8770

export async function loginFlow(serverUrl: string): Promise<void> {
  console.log(`${PREFIX} Starting authentication flow...`)

  const _config = await loadConfig()

  // Start local callback server (tries ports 8765-8770)
  const { server, callbackUrl } = await startCallbackServer()

  try {
    // Open browser to auth endpoint
    const authUrl = `${serverUrl}/auth/desktop?redirect_uri=${encodeURIComponent(callbackUrl)}`
    console.log(chalk.gray(`Opening browser to: ${authUrl}`))

    await open(authUrl)
    console.log(chalk.yellow(`${PREFIX} Waiting for authentication in browser...`))

    // Wait for callback with API key and tenant info
    const callbackData = await waitForCallback(server)

    if (!callbackData.apiKey) {
      throw new Error('No API key received from callback')
    }

    // Get user info to store username
    const userInfo = await getUserInfo(serverUrl, callbackData.apiKey)

    // Save config with tenant information
    await updateConfig({
      apiKey: callbackData.apiKey,
      serverUrl,
      username: userInfo.username,
      name: userInfo.name,
      avatarUrl: userInfo.avatarUrl,
      tenantId: callbackData.tenantId,
      tenantName: callbackData.tenantName,
    })

    console.log(`${PREFIX} ${chalk.green('✓ Authentication successful!')}`)
    console.log(chalk.gray(`Logged in as: ${userInfo.username}`))
    if (callbackData.tenantName) {
      console.log(chalk.gray(`Tenant: ${callbackData.tenantName}`))
    }
    console.log(chalk.gray(`Server: ${serverUrl}`))
  } catch (error) {
    console.error(
      chalk.red('✗ Authentication failed:'),
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw error
  } finally {
    server.close()
  }
}

export async function logoutFlow(): Promise<void> {
  const config = await loadConfig()

  if (!config.apiKey) {
    console.log(chalk.yellow(`${PREFIX} Not currently logged in`))
    return
  }

  await clearConfig()
  console.log(`${PREFIX} ${chalk.green('✓ Logged out successfully')}`)
}

export async function whoAmI(): Promise<void> {
  const config = await loadConfig()

  if (!config.apiKey || !config.username) {
    console.log(chalk.yellow(`${PREFIX} Not currently logged in`))
    console.log(chalk.gray('Run "guidemode login" to authenticate'))
    return
  }

  try {
    if (!config.serverUrl) {
      console.log(chalk.red(`${PREFIX} ✗ No server URL configured`))
      console.log(chalk.gray('Run "guidemode login" to authenticate'))
      return
    }
    const userInfo = await getUserInfo(config.serverUrl, config.apiKey)
    console.log(`${PREFIX} ${chalk.green(`Logged in as: ${userInfo.username}`)}`)
    console.log(chalk.gray(`Server: ${config.serverUrl}`))
    console.log(chalk.gray(`API Key: ${config.apiKey.substring(0, 12)}...`))
  } catch (_error) {
    console.log(chalk.red('✗ Invalid credentials'))
    console.log(chalk.gray('Run "guidemode login" to re-authenticate'))
  }
}

async function findAvailablePort(): Promise<number> {
  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
    const available = await new Promise<boolean>(resolve => {
      const testServer = createServer()
      testServer.once('error', () => resolve(false))
      testServer.listen(port, '127.0.0.1', () => {
        testServer.close(() => resolve(true))
      })
    })
    if (available) return port
  }
  throw new Error(`No available port in range ${PORT_RANGE_START}-${PORT_RANGE_END}`)
}

async function startCallbackServer(): Promise<{ server: Server; callbackUrl: string }> {
  const port = await findAvailablePort()

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400)
        res.end('Bad Request')
        return
      }
      const url = new URL(req.url, `http://127.0.0.1:${port}`)

      if (url.pathname === '/callback') {
        const apiKey = url.searchParams.get('key')
        const tenantId = url.searchParams.get('tenant_id')
        const tenantName = url.searchParams.get('tenant_name')
        const error = url.searchParams.get('error')

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #dc2626;">Authentication Failed</h1>
                <p>Error: ${error}</p>
                <p>You can close this browser window and try again.</p>
              </body>
            </html>
          `)
          server.emit('auth-error', error)
          return
        }

        if (apiKey) {
          const tenantInfo = tenantName ? ` for ${tenantName}` : ''
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #059669;">Authentication Successful!</h1>
                <p>You have been authenticated with the GuideMode CLI${tenantInfo}.</p>
                <p style="color: #6b7280;">You can close this browser window and return to your terminal.</p>
              </body>
            </html>
          `)
          server.emit('auth-success', { apiKey, tenantId, tenantName })
          return
        }
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found')
    })

    server.listen(port, '127.0.0.1', () => {
      resolve({
        server,
        callbackUrl: `http://127.0.0.1:${port}/callback`,
      })
    })

    server.on('error', (err: NodeJS.ErrnoException) => {
      reject(err)
    })
  })
}

async function waitForCallback(
  server: Server
): Promise<{ apiKey: string; tenantId?: string; tenantName?: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => {
        reject(new Error('Authentication timeout (5 minutes)'))
      },
      5 * 60 * 1000
    ) // 5 minutes

    server.once(
      'auth-success',
      (data: { apiKey: string; tenantId?: string; tenantName?: string }) => {
        clearTimeout(timeout)
        resolve(data)
      }
    )

    server.once('auth-error', (error: string) => {
      clearTimeout(timeout)
      reject(new Error(error))
    })
  })
}

async function getUserInfo(
  serverUrl: string,
  apiKey: string
): Promise<{ username: string; name: string; avatarUrl: string }> {
  const response = await fetch(`${serverUrl}/auth/session`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to get user info: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as {
    authenticated?: boolean
    user?: { username: string; name?: string; avatarUrl?: string }
  }

  if (!data.authenticated || !data.user) {
    throw new Error('Invalid API key or user not found')
  }

  return {
    username: data.user.username,
    name: data.user.name || '',
    avatarUrl: data.user.avatarUrl || '',
  }
}
