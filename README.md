# @guidemode/cli

> **Command-line interface for GuideMode.**

A simple CLI for authenticating with GuideMode and managing sessions from your terminal.

## Installation

```bash
npm install -g @guidemode/cli
```

## Usage

### Authentication

```bash
# Login to GuideMode
guidemode login

# Check who you're logged in as
guidemode whoami

# Logout
guidemode logout
```

That's it! The CLI shares authentication with the desktop app, so you only need to login once.

## What It Does

- **Login**: Opens browser for GitHub OAuth authentication
- **Session Info**: Check your authentication status
- **Logout**: Clear stored credentials

Perfect for CI/CD pipelines, scripts, or terminal-focused workflows.

## Configuration

Shares config with desktop app: `~/.guidemode/config.json`

```json
{
  "apiKey": "your-api-key",
  "serverUrl": "https://app.guidemode.dev",
  "username": "your-username"
}
```

## For Developers

### Build from Source

```bash
git clone https://github.com/guidemode/cli.git
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

- [@guidemode/desktop](https://github.com/guidemode/desktop) - Desktop app
- [@guidemode/types](https://github.com/guidemode/types) - Shared types

## License

MIT License - see [LICENSE](LICENSE)

## Support

- 💬 [**Discussions**](https://github.com/orgs/guidemode/discussions) - Ask questions, share ideas
- 🐛 [**Issues**](https://github.com/guidemode/desktop/issues) - Report bugs, request features
- 📧 **Email**: support@guidemode.dev
