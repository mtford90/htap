# htpx - Terminal HTTP Interception Toolkit

## Planning & Status

**`PLAN.md` is the source of truth for all development work on this project.**

- Always check `PLAN.md` before starting work to understand current priorities
- Update `PLAN.md` when completing tasks (move to Completed section)
- Update `PLAN.md` when discovering new tasks or requirements
- Keep task descriptions concise but informative

Published to npm as `htpx-cli` (v0.1.0). The name `htpx` was taken.

## Project Overview

htpx is a terminal-based HTTP interception/inspection tool with project-scoped isolation and a lazygit-style TUI. It captures HTTP/HTTPS traffic through a MITM proxy and displays it in an interactive terminal interface.

## Architecture

```
~/projects/client-a/
├── .htpx/
│   ├── proxy.port        # TCP port for HTTP_PROXY
│   ├── control.sock      # Unix socket for TUI <-> daemon
│   ├── requests.db       # SQLite - captured traffic
│   └── ca.pem            # CA certificate
└── src/...
```

Key design decisions:
- **Project-scoped isolation** - each project gets its own `.htpx/` directory
- **Unix socket for control API** - avoids port conflicts
- **TCP for proxy** - required by HTTP_PROXY standard
- **SQLite for persistence** - simple, embedded storage
- **Auto-start daemon** - starts on first `htpx intercept`

## Technology Stack

- **Runtime**: Node.js (>=20)
- **Language**: TypeScript
- **CLI**: commander
- **TUI**: ink (React for terminals)
- **Proxy**: mockttp (HTTP Toolkit's MITM library)
- **Storage**: better-sqlite3
- **Testing**: Vitest

## Commands

```bash
npm run build      # Compile TypeScript
npm run typecheck  # Type checking only
npm run lint       # ESLint
npm test           # Run all tests
npm run dev        # Watch mode for development
```

## Testing

### Tools

- **Vitest** - Test runner (configured in `vitest.config.ts`)
- **ink-testing-library** - Component-level TUI testing with keyboard input simulation
- **cli-testing-library** - Full CLI process spawning for e2e tests

### Test Types

#### Unit Tests (`tests/unit/`)
Pure functions with no external dependencies. Fast, isolated, deterministic.

**Use for**: Formatters, utilities, data transformations, SQLite operations (with temp files)

**Examples**: `formatters.test.ts`, `curl.test.ts`, `har.test.ts`, `storage.test.ts`

#### Component Tests (`tests/unit/tui/`)
ink components tested with ink-testing-library. Can simulate keyboard input.

**Use for**: TUI component behaviour, keyboard interactions, state changes

**Key pattern** - Use `__testEnableInput` prop to bypass TTY check:
```tsx
const { lastFrame, stdin } = render(<App __testEnableInput />);
stdin.write("u");
await new Promise((resolve) => setTimeout(resolve, 50)); // Wait for re-render
expect(lastFrame()).toContain("expected text");
```

**Note**: `stdin.write()` requires async handling - React needs time to process state updates.

#### Integration Tests (`tests/integration/`)
Tests that spin up real daemon/proxy but don't spawn CLI processes.

**Use for**: Daemon lifecycle, proxy interception, control API communication, multi-component interactions

**Examples**: `daemon.test.ts`, `logging.test.ts`, `version-check.test.ts`

#### E2E Tests (`tests/e2e/`)
Full CLI process spawning with cli-testing-library. Tests the complete user flow.

**Use for**: CLI command output, full integration from CLI entry point to TUI render

**Limitations**: cli-testing-library doesn't support PTY/raw mode, so keyboard input tests belong in component tests instead.

**Example**: `tui.test.ts` - spawns `node dist/cli/index.js tui --ci`

### When to Write Which Test

| Scenario | Test Type |
|----------|-----------|
| New utility/formatter function | Unit |
| New TUI keyboard shortcut | Component (ink-testing-library) |
| New CLI command output | E2E |
| Daemon/proxy behaviour | Integration |
| Data persistence | Unit (SQLite with temp file) |

### Running Tests

```bash
npm test                           # All tests
npm run test:unit                  # Unit tests only
npm run test:int                   # Integration tests only
npm test -- tests/path/to/file    # Specific file
npm run test:watch                 # Watch mode
```

Always run the full verification suite after making changes:
```bash
npm run typecheck && npm run lint && npm test
```

## Key Files

| Path | Purpose |
|------|---------|
| `src/cli/index.ts` | CLI entry point |
| `src/cli/commands/` | Command implementations |
| `src/daemon/` | Proxy daemon (mockttp, control API) |
| `src/tui/` | ink TUI components |
| `src/shared/project.ts` | Project root detection, .htpx paths |
| `src/shared/daemon.ts` | Daemon lifecycle management |

## Development Notes

- The daemon runs as a child process and communicates via Unix socket
- mockttp handles CA certificate generation automatically
- Sessions are tracked by parent PID for automatic cleanup
- The TUI connects to the daemon's control socket for live updates

## Release Process

To publish a new version:
```bash
npm version patch  # or minor/major
git push && git push --tags
```

CI will automatically publish to npm on version tags (requires `NPM_TOKEN` secret in GitHub).

## Repository

- **npm**: https://www.npmjs.com/package/htpx-cli
- **GitHub**: https://github.com/mtford90/htpx
