# @guideai-dev/cli

Command-line interface for GuideAI - monitor and analyze your AI coding agent sessions.

## Installation

```bash
npm install -g @guideai-dev/cli
# or
pnpm add -g @guideai-dev/cli
# or
yarn global add @guideai-dev/cli
```

## Usage

### Authentication

```bash
# Login to GuideAI server
guideai login

# Login to custom server
guideai login --server https://your-server.com

# Check authentication status
guideai whoami

# Logout
guideai logout
```

### Session Management

```bash
# Upload session files
guideai upload /path/to/session.jsonl

# List recent sessions
guideai sessions

# View session details
guideai session <session-id>
```

## Features

- **OAuth Authentication**: Secure GitHub OAuth flow
- **Session Upload**: Upload AI agent session files for processing
- **Session Management**: List and view session details
- **Cross-platform**: Works on macOS, Windows, and Linux
- **Shared Config**: Uses same configuration as desktop app

## Configuration

Config file location: `~/.guideai/config.json`

Example:
```json
{
  "apiKey": "your-api-key",
  "serverUrl": "https://guideai.dev",
  "username": "your-username",
  "tenantId": "your-tenant-id",
  "tenantName": "Your Team"
}
```

## Development

This package is part of the GuideAI monorepo and is automatically synced to this repository.

### Building

```bash
# Build both ESM and CJS
pnpm build

# Build ESM only
pnpm build:esm

# Build CJS only
pnpm build:cjs

# Development (watch mode)
pnpm dev

# Type checking
pnpm typecheck

# Run tests
pnpm test
```

### Contributing

We welcome contributions! Please:

1. Fork this repository
2. Create a feature branch
3. Add features or fix bugs
4. Submit a pull request

**Note**: All pull requests are reviewed and manually backported to the private GuideAI monorepo.

## Architecture

- **Framework**: Commander.js for CLI parsing
- **Language**: TypeScript with full type safety
- **Styling**: Chalk for terminal colors
- **Browser Integration**: Cross-platform URL opening for OAuth

## Package Configuration

**Binary**:
```json
{
  "bin": {
    "guideai": "./dist/esm/cli.js"
  }
}
```

**Dual Module Support**: Both ESM and CommonJS distributions included.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Links

- [GuideAI Website](https://guideai.dev)
- [Documentation](https://docs.guideai.dev)
- [GitHub Organization](https://github.com/guideai-dev)
- [npm Package](https://github.com/guideai-dev/cli/pkgs/npm/cli)

## Related Packages

- [@guideai-dev/desktop](https://github.com/guideai-dev/desktop) - Desktop menubar application
- [@guideai-dev/types](https://github.com/guideai-dev/types) - Shared TypeScript types
- [@guideai-dev/session-processing](https://github.com/guideai-dev/session-processing) - Session processing and AI models
