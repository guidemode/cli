import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock config
vi.mock('./config.js', () => ({
  loadConfig: vi.fn(),
  DEFAULT_SYNC_HOOKS: ['Stop', 'PreCompact', 'SessionEnd'],
  CONFIG_DIR: '/tmp/.guidemode',
  CONFIG_FILE: '/tmp/.guidemode/config.json',
  LOG_DIR: '/tmp/.guidemode/logs',
  LOG_FILE: '/tmp/.guidemode/logs/plugin-upload.log',
}))

// Mock logger (to avoid writing files)
vi.mock('./utils/logger.js', () => ({
  logToFile: vi.fn(),
}))

// Mock git utils
vi.mock('./utils/git.js', () => ({
  getGitMetadata: vi.fn().mockResolvedValue({
    remoteUrl: 'https://github.com/test/repo',
    branch: 'main',
    commitHash: 'abc123',
    repoName: 'test/repo',
  }),
  detectProjectType: vi.fn().mockResolvedValue('nodejs'),
}))

import { loadConfig } from './config.js'
import { logToFile } from './utils/logger.js'
import { runSync } from './sync.js'

const mockedLoadConfig = vi.mocked(loadConfig)
const mockedLogToFile = vi.mocked(logToFile)

describe('runSync', () => {
  let tmpDir: string
  let transcriptPath: string

  beforeEach(async () => {
    vi.clearAllMocks()
    tmpDir = await mkdtemp(join(tmpdir(), 'sync-test-'))
    transcriptPath = join(tmpDir, 'test-session.jsonl')
    await writeFile(transcriptPath, '{"type":"message","content":"hello"}\n')

    mockedLoadConfig.mockResolvedValue({
      apiKey: 'gm_test_key',
      serverUrl: 'https://test.guidemode.dev',
      syncHooks: ['Stop', 'PreCompact', 'SessionEnd'],
    })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('skips when config has no apiKey', async () => {
    mockedLoadConfig.mockResolvedValue({ serverUrl: 'https://test.guidemode.dev' })

    await runSync({
      sessionId: 'test-session',
      transcriptPath,
      cwd: tmpDir,
      hookEvent: 'Stop',
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockedLogToFile).toHaveBeenCalledWith(
      'INFO',
      expect.stringContaining('No apiKey or serverUrl')
    )
  })

  it('skips when hook event is not enabled', async () => {
    mockedLoadConfig.mockResolvedValue({
      apiKey: 'gm_test_key',
      serverUrl: 'https://test.guidemode.dev',
      syncHooks: ['SessionEnd'],
    })

    await runSync({
      sessionId: 'test-session',
      transcriptPath,
      cwd: tmpDir,
      hookEvent: 'Stop',
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockedLogToFile).toHaveBeenCalledWith(
      'INFO',
      expect.stringContaining('Hook Stop not enabled')
    )
  })

  it('skips upload when hash matches', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ needsUpload: false }),
    })

    await runSync({
      sessionId: 'test-session',
      transcriptPath,
      cwd: tmpDir,
      hookEvent: 'Stop',
    })

    // Should have called check-hash but not upload-v2
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toContain('check-hash')
    expect(mockedLogToFile).toHaveBeenCalledWith(
      'INFO',
      expect.stringContaining('hash match')
    )
  })

  it('triggers processing on SessionEnd even when hash matches', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ needsUpload: false }),
      })
      .mockResolvedValueOnce({ ok: true })

    await runSync({
      sessionId: 'test-session',
      transcriptPath,
      cwd: tmpDir,
      hookEvent: 'SessionEnd',
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[1][0]).toContain('session-processing/process')
  })

  it('uploads when hash does not match', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ needsUpload: true }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 })

    await runSync({
      sessionId: 'test-session',
      transcriptPath,
      cwd: tmpDir,
      hookEvent: 'Stop',
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[1][0]).toContain('upload-v2')

    // Verify payload structure
    const uploadCall = mockFetch.mock.calls[1]
    const body = JSON.parse(uploadCall[1].body)
    expect(body.provider).toBe('claude-code')
    expect(body.sessionId).toBe('test-session')
    expect(body.fileHash).toBeTruthy()
    expect(body.contentEncoding).toBe('gzip')
    expect(body.repositoryName).toBe('test/repo')
    expect(body.gitBranch).toBe('main')
    expect(body.repositoryMetadata.detectedRepositoryType).toBe('nodejs')
  })

  it('computes correct SHA256 hash', async () => {
    const content = '{"type":"message","content":"hello"}\n'
    const expectedHash = createHash('sha256').update(content).digest('hex')

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ needsUpload: true }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 })

    await runSync({
      sessionId: 'test-session',
      transcriptPath,
      cwd: tmpDir,
      hookEvent: 'Stop',
    })

    // Check that the hash check URL contains the correct hash
    const checkUrl = mockFetch.mock.calls[0][0] as string
    expect(checkUrl).toContain(`fileHash=${expectedHash}`)
  })

  it('handles missing transcript file gracefully', async () => {
    await runSync({
      sessionId: 'test-session',
      transcriptPath: '/nonexistent/path/file.jsonl',
      cwd: tmpDir,
      hookEvent: 'Stop',
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockedLogToFile).toHaveBeenCalledWith(
      'ERROR',
      expect.stringContaining('Transcript file not found')
    )
  })

  it('handles network error on hash check gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    await runSync({
      sessionId: 'test-session',
      transcriptPath,
      cwd: tmpDir,
      hookEvent: 'Stop',
    })

    expect(mockedLogToFile).toHaveBeenCalledWith(
      'ERROR',
      expect.stringContaining('Hash check request failed')
    )
  })

  it('handles network error on upload gracefully', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ needsUpload: true }),
      })
      .mockRejectedValueOnce(new Error('Upload failed'))

    await runSync({
      sessionId: 'test-session',
      transcriptPath,
      cwd: tmpDir,
      hookEvent: 'Stop',
    })

    expect(mockedLogToFile).toHaveBeenCalledWith(
      'ERROR',
      expect.stringContaining('Upload request failed')
    )
  })
})
