# CLI Reference

[Back to README](../README.md)

## Global Options

| Flag                  | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| `-v, --verbose`       | Increase log verbosity (stackable: `-vv`, `-vvv`)            |
| `-d, --dir <path>`    | Override project root directory (`.httap` is appended)      |
| `-c, --config <path>` | Override httap data directory directly (no `.httap` appended) |

### Environment Variables

| Variable        | Equivalent flag | Description                                              |
| --------------- | --------------- | -------------------------------------------------------- |
| `HTTAP_CONFIG` | `--config`      | Httap data directory (highest priority, no `.httap` appended) |
| `HTTAP_DIR`    | `--dir`         | Project root directory (`.httap` is appended)           |

CLI flags override environment variables. `--config` / `HTTAP_CONFIG` takes precedence over `--dir` / `HTTAP_DIR`.

**Resolution order:**

1. `--config` / `HTTAP_CONFIG` — use as httap data directory directly
2. `--dir` / `HTTAP_DIR` — use as project root, append `.httap`
3. Auto-detect — walk directory tree for `.git` / `.httap`, append `.httap`

## `httap on`

Output shell `export` statements to start intercepting HTTP traffic. Use with `eval`:

```bash
eval "$(httap on)"
```

If run directly in a TTY (without `eval`), shows usage instructions.

| Flag                  | Description                                   |
| --------------------- | --------------------------------------------- |
| `-l, --label <label>`  | Label this session (visible in TUI and MCP)              |
| `-s, --source <name>` | Label the source process (auto-detected from PID if omitted) |
| `--no-restart`         | Don't auto-restart daemon on version mismatch            |

## `httap off`

Output shell `unset` statements to stop intercepting HTTP traffic. Use with `eval`:

```bash
eval "$(httap off)"
```

## `httap browser`

Launch a browser pre-configured to use the httap proxy. The browser runs in an isolated temporary profile with session attribution via a browser extension — all traffic appears in the TUI with the correct source.

```bash
httap browser                              # auto-detect and launch
httap browser https://example.com          # open a specific URL
httap browser --browser firefox            # choose browser by name/type
httap browser --browser brave              # works with any supported browser
httap browser --label "manual testing"     # custom session label
```

| Flag                    | Description                                                     |
| ----------------------- | --------------------------------------------------------------- |
| `[url]`                 | URL to open in the browser (optional)                           |
| `-b, --browser <name>`  | Browser to use — matches type (`chrome`, `firefox`) or name (`Brave`, `Zen Browser`). Auto-detected if omitted. |
| `-l, --label <label>`   | Session label (defaults to browser name)                        |

**Supported browsers:**

| Engine   | Browsers                                          |
| -------- | ------------------------------------------------- |
| Chromium | Chrome, Brave, Edge, Vivaldi, Arc, Chromium       |
| Firefox  | Firefox, Zen Browser, LibreWolf                   |

The browser process is tied to the CLI — close the browser window or press `Ctrl+C` to stop. The temporary profile is cleaned up automatically on exit.

## `httap tui`

Open the interactive TUI. See [TUI documentation](tui.md) for keybindings and features.

| Flag   | Description                                 |
| ------ | ------------------------------------------- |
| `--ci` | CI mode: render once and exit (for testing) |

## `httap status`

Show comprehensive status: daemon state, interception state, sessions, request count, loaded interceptors.

## `httap daemon stop`

Stop the daemon.

## `httap daemon restart`

Restart the daemon (or start it if not running).

## `httap requests`

List and filter captured requests. Output is a colour-coded table with short IDs — pipe to other tools or use `--json` for structured output.

```bash
httap requests                              # list recent (default limit 50)
httap requests --method GET,POST            # filter by method
httap requests --status 4xx                 # filter by status range
httap requests --host api.example.com       # filter by host
httap requests --path /api/v2               # filter by path prefix
httap requests --search "keyword"           # substring match on URL
httap requests --search "/users\\/\\d+/"    # regex literal match on URL
httap requests --regex "users/\\d+$"       # regex pattern match on URL
httap requests --since 5m                   # last 5 minutes
httap requests --since yesterday            # since midnight yesterday
httap requests --since 10am --before 11am   # time window
httap requests --header "content-type:application/json"  # header filter
httap requests --intercepted-by mock-users  # interceptor filter
httap requests --saved                       # only saved/bookmarked requests
httap requests --limit 100 --offset 50      # pagination
httap requests --json                       # JSON output
```

| Flag                       | Description                                              |
| -------------------------- | -------------------------------------------------------- |
| `--method <methods>`       | Filter by HTTP method (comma-separated)                  |
| `--status <range>`         | Status range: `2xx`, `4xx`, exact `401`, etc.            |
| `--host <host>`            | Filter by hostname                                       |
| `--path <prefix>`          | Filter by path prefix                                    |
| `--search <text>`          | Substring match on URL, or `/pattern/flags` regex literal |
| `--regex <pattern>`        | JavaScript regex pattern match on URL                     |
| `--since <time>`           | Since time (5m, 2h, 10am, yesterday, monday, 2024-01-01) |
| `--before <time>`          | Before time (same formats as --since)                    |
| `--header <spec>`          | Header name or name:value                                |
| `--header-target <target>` | `request`, `response`, or `both` (default)               |
| `--saved`                  | Filter to saved/bookmarked requests only                 |
| `--source <name>`          | Filter by request source (e.g. node, python)             |
| `--intercepted-by <name>`  | Filter by interceptor name                               |
| `--limit <n>`              | Max results (default 50)                                 |
| `--offset <n>`             | Skip results (default 0)                                 |
| `--json`                   | JSON output                                              |

### `httap requests search <query>`

Full-text search through body content.

```bash
httap requests search "timeout"                        # search request + response bodies
httap requests search "Bearer " --target request      # request body only
httap requests search "error_code" --target response  # response body only
httap requests search "Alice" --method POST --host api.example.com
```

| Flag              | Description                                           |
| ----------------- | ----------------------------------------------------- |
| `--target <kind>` | `request`, `response`, or `both` (default)            |
| `--limit <n>`     | Max results (default 50)                              |
| `--offset <n>`    | Skip results (default 0)                              |
| `--json`          | JSON output                                           |
| Common filters    | `--method`, `--status`, `--host`, `--path`, etc.      |

### `httap requests query <jsonpath>`

Query JSON bodies using JSONPath expressions (e.g. `$.data.id`). Supports `--value`, `--target` (request/response/both).

### `httap requests count`

Count requests matching the current filters.

### `httap requests clear`

Clear all captured requests. Prompts for confirmation unless `--yes` is passed.

## `httap request <id>`

View a single request in detail. Accepts full UUIDs or abbreviated prefixes (first 7+ characters).

```bash
httap request a1b2c3d              # full detail view
httap request a1b2c3d --json       # JSON output
```

### `httap request <id> body`

Dump the response body to stdout (raw, pipeable). Use `--request` for the request body instead.

```bash
httap request a1b2c3d body                # response body
httap request a1b2c3d body --request      # request body
httap request a1b2c3d body | jq .         # pipe to jq
```

### `httap request <id> export <format>`

Export a request as `curl` or `har`.

```bash
httap request a1b2c3d export curl
httap request a1b2c3d export har
```

## `httap sessions`

List active proxy sessions.

| Flag     | Description |
| -------- | ----------- |
| `--json` | JSON output |

## `httap clear`

Clear all captured requests.

## `httap debug-dump`

Collect diagnostics (system info, daemon status, recent logs) into `.httap/debug-dump-<timestamp>.json`.

## `httap mcp`

Start the MCP server (stdio transport). See [MCP documentation](mcp.md).

## `httap interceptors`

List loaded interceptors, or manage them with subcommands. See [Interceptors documentation](interceptors.md).

### `httap interceptors init`

Scaffold an example interceptor in `.httap/interceptors/`.

### `httap interceptors reload`

Reload interceptors from disk without restarting the daemon.

### `httap interceptors logs`

View the interceptor event log. Events include match results, mock responses, errors, timeouts, and `ctx.log()` output.

```bash
httap interceptors logs                         # recent events
httap interceptors logs --name mock-users       # filter by interceptor
httap interceptors logs --level error           # filter by level
httap interceptors logs --limit 100             # more results
httap interceptors logs --follow                # live tail (Ctrl+C to stop)
httap interceptors logs --follow --json         # live tail as NDJSON
```

| Flag                   | Description                         |
| ---------------------- | ----------------------------------- |
| `--name <interceptor>` | Filter by interceptor name          |
| `--level <level>`      | Filter by level (info, warn, error) |
| `--limit <n>`          | Max events (default 50)             |
| `--follow`             | Live tail — poll for new events     |
| `--json`               | JSON output                         |

### `httap interceptors logs clear`

Clear the interceptor event log.

## `httap completions <shell>`

Generate shell completion scripts. Supports `zsh`, `bash`, and `fish`.

```bash
eval "$(httap completions zsh)"    # add to .zshrc
eval "$(httap completions bash)"   # add to .bashrc
httap completions fish | source    # add to fish config
```
