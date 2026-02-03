# htpx - Terminal HTTP Interception Toolkit

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

Tests are organised into:
- `tests/unit/` - Pure functions, formatters, SQLite operations
- `tests/integration/` - Daemon lifecycle, proxy interception, control API
- `tests/e2e/` - Full TUI tests using ink-testing-library

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
