# CLI - GuideAI Command Line Interface

Commander.js-based CLI for interacting with the GuideAI server, featuring authentication and API integration.

## Architecture

### Stack
- **Commander.js**: Command-line interface framework
- **TypeScript**: Full type safety
- **Chalk**: Terminal text styling
- **Open**: Cross-platform URL opening
- **Dual Build**: Both ESM and CommonJS support

### Structure

```
src/
├── cli.ts               # Main CLI entry point and commands
├── auth.ts              # Authentication flow implementation
└── index.ts             # Package exports
```

## Commands

### Build System

```bash
# Build both ESM and CJS distributions
pnpm build

# Build ESM only
pnpm build:esm

# Build CJS only
pnpm build:cjs

# Development (watch mode)
pnpm dev

# Clean build artifacts
pnpm clean
```

### Testing

```bash
# Run tests with Vitest
pnpm test
```

### Running CLI

```bash
# From workspace root
pnpm cli

# Direct execution after build
node packages/cli/dist/esm/cli.js
```

## Development Workflow

**IMPORTANT: Always run quality checks locally before committing changes.**

### Pre-Commit Checklist

Run these commands in the **CLI package directory** (`packages/cli/`) before committing:

```bash
# 1. Linting (REQUIRED - zero errors)
pnpm lint

# 2. Building (REQUIRED - must succeed)
# Builds both ESM and CJS distributions
pnpm build

# Note: No typecheck script exists yet (TypeScript checks run during build)
# Note: No tests exist yet - add tests when adding new features
```

### Quick Quality Check

Run all checks in sequence:

```bash
# From packages/cli/
pnpm lint && pnpm build
```

**If any check fails, your code MUST NOT be committed. Fix all errors before proceeding.**

### Code Quality Standards

- **Zero tolerance**: No lint errors or build failures allowed in commits
- **Type safety**: Proper TypeScript types throughout (no `any` without justification)
- **Dual builds**: Both ESM and CJS must build successfully
- **Consistent style**: Biome enforces consistent code formatting

### Testing Guidelines

**Note**: Currently no tests exist for the CLI package.

When adding tests in the future:
- **Test new features**: Add tests for all new functionality
- **Keep it pragmatic**: Focus on core CLI commands and auth flow
- **Use existing patterns**: Follow test patterns from other packages
- **Run locally first**: Always run tests before pushing

### From Workspace Root

To check the CLI package from the workspace root:

```bash
pnpm --filter @guideai-dev/cli lint
pnpm --filter @guideai-dev/cli build
```

## CLI Commands

### Authentication

**Login**:
```bash
guideai login [--server <url>]
```
- **Default Server**: `http://localhost:3000`
- **Flow**: Opens browser for OAuth authentication
- **Storage**: Saves authentication token locally

**Logout**:
```bash
guideai logout
```
- Removes stored authentication token
- Confirms successful logout

**Who Am I**:
```bash
guideai whoami
```
- Shows current authenticated user
- Displays authentication status

## Build Configuration

### Dual Module Support

**ESM Build** (`tsconfig.json`):
- **Target**: ES2022
- **Module**: ESNext
- **Output**: `dist/esm/`
- **Declaration**: Type definitions included

**CJS Build** (`tsconfig.cjs.json`):
- **Target**: ES2022
- **Module**: CommonJS
- **Output**: `dist/cjs/`
- **Package Marker**: Auto-generated `package.json` with `"type": "commonjs"`

### Package Configuration

**Exports**:
```json
{
  ".": {
    "types": "./dist/esm/index.d.ts",
    "import": "./dist/esm/index.js",
    "require": "./dist/cjs/index.js"
  }
}
```

**Binary**:
```json
{
  "bin": {
    "guideai": "./dist/esm/cli.js"
  }
}
```

## Authentication Flow

### OAuth Integration
1. **Initiate**: CLI opens browser to server OAuth endpoint
2. **Authorize**: User grants permission via GitHub OAuth
3. **Callback**: Server processes OAuth and returns token
4. **Storage**: CLI saves token for future requests
5. **Verification**: Subsequent commands use stored token

### Token Management
- **Storage**: Local file system (platform-specific)
- **Security**: Token stored securely with appropriate permissions
- **Expiry**: Automatic token refresh handling
- **Validation**: Server-side token verification

## Dependencies

### Runtime
- `@guideai/types`: Shared TypeScript definitions
- `chalk`: Terminal colors and styling
- `commander`: CLI framework and argument parsing
- `open`: Cross-platform browser opening

### Development
- `@types/node`: Node.js type definitions
- `typescript`: TypeScript compiler
- `vitest`: Testing framework

## Usage Examples

### Basic Authentication
```bash
# Login to default server
guideai login

# Login to custom server
guideai login --server https://api.guideai.com

# Check authentication status
guideai whoami

# Logout
guideai logout
```

### Development
```bash
# Install dependencies
pnpm install

# Build CLI
pnpm build

# Test CLI
pnpm test

# Run in development
pnpm dev
```

## Key Architectural Decisions

1. **Dual Distribution**: Supports both ESM and CJS for maximum compatibility
2. **Browser-based Auth**: Uses system browser for OAuth flow
3. **Local Token Storage**: Secure local storage for authentication
4. **Type Safety**: Full TypeScript integration with shared types
5. **Cross-platform**: Works on Windows, macOS, and Linux
6. **Minimal Dependencies**: Focused dependency tree for fast installation

## Error Handling

- **Network Errors**: Graceful handling of connection issues
- **Authentication Errors**: Clear messaging for auth failures
- **Validation Errors**: Input validation with helpful error messages
- **Server Errors**: Proper error propagation from API responses

## Future Extensibility

The CLI is designed to easily add new commands:

```typescript
program
  .command('new-feature')
  .description('Description of new feature')
  .option('--option <value>', 'Feature option')
  .action(async (options) => {
    // Implementation
  })
```

Commands can leverage:
- Shared authentication system
- Common error handling patterns
- Consistent styling with Chalk
- Type-safe API integration