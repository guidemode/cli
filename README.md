# @guideai-dev/cli

> **Command-line interface for GuideAI.**

A simple CLI for authenticating with GuideAI and managing sessions from your terminal.

## Installation

```bash
npm install -g @guideai-dev/cli
```

## Usage

### Authentication

```bash
# Login to GuideAI
guideai login

# Check who you're logged in as
guideai whoami

# Logout
guideai logout
```

That's it! The CLI shares authentication with the desktop app, so you only need to login once.

## What It Does

- **Login**: Opens browser for GitHub OAuth authentication
- **Session Info**: Check your authentication status
- **Logout**: Clear stored credentials

Perfect for CI/CD pipelines, scripts, or terminal-focused workflows.

## Configuration

Shares config with desktop app: `~/.guideai/config.json`

```json
{
  "apiKey": "your-api-key",
  "serverUrl": "https://be.guideai.dev",
  "username": "your-username"
}
```

## For Developers

### Build from Source

```bash
git clone https://github.com/guideai-dev/cli.git
cd cli
pnpm install
pnpm build
```

**See [CLAUDE.md](CLAUDE.md) for:**
- Development setup
- Architecture details
- Adding new commands

### Tech Stack

- Commander.js for CLI parsing
- Dual build (ESM + CommonJS)
- TypeScript with full type safety

## Related Packages

- [@guideai-dev/desktop](https://github.com/guideai-dev/desktop) - Desktop app
- [@guideai-dev/types](https://github.com/guideai-dev/types) - Shared types

## License

MIT License - see [LICENSE](LICENSE)

## Support

- 💬 [**Discussions**](https://github.com/orgs/guideai-dev/discussions) - Ask questions, share ideas
- 🐛 [**Issues**](https://github.com/guideai-dev/desktop/issues) - Report bugs, request features
- 📧 **Email**: support@guideai.dev
