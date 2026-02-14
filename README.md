# guidemode

> **CLI for [GuideMode](https://guidemode.dev) — capture and analyze your Claude Code sessions.**

## Quick Start

```bash
npx guidemode
```

This walks you through everything:
1. Browser login (GitHub OAuth)
2. Installing Claude Code sync hooks
3. Optionally installing the CLI globally

Once set up, your Claude Code sessions sync automatically to GuideMode.

## Install Globally (Optional)

```bash
npm install -g guidemode
```

## Claude Code Plugin

For teams using Claude Code, install the plugin for automatic session sync:

```
/plugin marketplace add guidemode/guidemode-marketplace
/plugin install guidemode-sync@guidemode-marketplace
```

The plugin uses the same CLI under the hood — `npx guidemode` handles everything.

## Commands

```bash
guidemode                  # First run: guided setup. After: show help
guidemode setup            # Re-run setup (login + hooks)
guidemode setup --force    # Force re-authentication
guidemode login            # Login only
guidemode logout           # Clear credentials
guidemode whoami           # Show current user
guidemode status           # Health check
guidemode status --verbose # Detailed health check
guidemode sync             # Sync current session (used by hooks)
guidemode logs             # View sync logs
guidemode logs --errors    # Show only errors
guidemode logs --follow    # Tail logs in real-time
```

## Configuration

Config lives at `~/.guidemode/config.json`:

```json
{
  "apiKey": "gm_...",
  "serverUrl": "https://app.guidemode.dev",
  "tenantId": "your-tenant-id",
  "tenantName": "Your Team",
  "syncHooks": ["Stop", "PreCompact", "SessionEnd"]
}
```

Omit `syncHooks` to enable all three (default).

## For Developers

```bash
git clone https://github.com/guidemode/guidemode.git
cd guidemode/packages/cli
pnpm install && pnpm build
```

See [CLAUDE.md](CLAUDE.md) for architecture and development details.

## License

MIT
