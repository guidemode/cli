import { describe, expect, it } from 'vitest'
import { extractRepoName, normalizeGitUrl } from './git.js'

describe('normalizeGitUrl', () => {
  it('converts SSH git@ URL to HTTPS', () => {
    expect(normalizeGitUrl('git@github.com:org/repo.git')).toBe(
      'https://github.com/org/repo.git'
    )
  })

  it('converts SSH git@ URL without .git', () => {
    expect(normalizeGitUrl('git@github.com:org/repo')).toBe('https://github.com/org/repo')
  })

  it('converts ssh:// URL to HTTPS', () => {
    expect(normalizeGitUrl('ssh://git@github.com/org/repo.git')).toBe(
      'https://github.com/org/repo.git'
    )
  })

  it('passes through HTTPS URLs unchanged', () => {
    expect(normalizeGitUrl('https://github.com/org/repo.git')).toBe(
      'https://github.com/org/repo.git'
    )
  })

  it('passes through other URLs unchanged', () => {
    expect(normalizeGitUrl('https://gitlab.com/org/repo')).toBe('https://gitlab.com/org/repo')
  })
})

describe('extractRepoName', () => {
  it('extracts org/repo from HTTPS URL', () => {
    expect(extractRepoName('https://github.com/org/repo.git')).toBe('org/repo')
  })

  it('extracts org/repo from HTTPS URL without .git', () => {
    expect(extractRepoName('https://github.com/org/repo')).toBe('org/repo')
  })

  it('extracts org/repo from SSH URL', () => {
    expect(extractRepoName('git@github.com:org/repo.git')).toBe('org/repo')
  })

  it('extracts org/repo from SSH URL without .git', () => {
    expect(extractRepoName('git@github.com:org/repo')).toBe('org/repo')
  })

  it('returns empty string for invalid URL', () => {
    expect(extractRepoName('not-a-url')).toBe('')
  })

  it('handles nested paths', () => {
    expect(extractRepoName('https://github.com/nested/org/repo.git')).toBe('org/repo')
  })
})
