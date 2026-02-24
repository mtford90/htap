# CLI Reference

[Back to README](../README.md)

## Global Options

| Flag                  | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| `-v, --verbose`       | Increase log verbosity (stackable: `-vv`, `-vvv`)            |
| `-d, --dir <path>`    | Override project root directory (`.htap` is appended)      |
| `-c, --config <path>` | Override htap data directory directly (no `.htap` appended) |

### Environment Variables

| Variable        | Equivalent flag | Description                                              |
| --------------- | --------------- | -------------------------------------------------------- |
| `HTAP_CONFIG` | `--config`      | Htap data directory (highest priority, no `.htap` appended) |
| `HTAP_DIR`    | `--dir`         | Project root directory (`.htap` is appended)           |

CLI flags override environment variables. `--config` / `HTAP_CONFIG` takes precedence over `--dir` / `HTAP_DIR`.

**Resolution order:**

1. `--config` / `HTAP_CONFIG` — use as htap data directory directly
2. `--dir` / `HTAP_DIR` — use as project root, append `.htap`
3. Auto-detect — walk directory tree for `.git` / `.htap`, append `.htap`

## `htap on`

Output shell `export` statements to start intercepting HTTP traffic. Use with `eval`:

```bash
eval "$(htap on)"
```

If run directly in a TTY (without `eval`), shows usage instructions.

| Flag                  | Description                                   |
| --------------------- | --------------------------------------------- |
| `-l, --label <label>`  | Label this session (visible in TUI and MCP)              |
| `-s, --source <name>` | Label the source process (auto-detected from PID if omitted) |
| `--no-restart`         | Don't auto-restart daemon on version mismatch            |

## `htap off`

Output shell `unset` statements to stop intercepting HTTP traffic. Use with `eval`:

```bash
eval "$(htap off)"
```

## `htap browser`

Launch a browser pre-configured to use the htap proxy. The browser runs in an isolated temporary profile with session attribution via a browser extension — all traffic appears in the TUI with the correct source.

```bash
htap browser                              # auto-detect and launch
htap browser https://example.com          # open a specific URL
htap browser --browser firefox            # choose browser by name/type
htap browser --browser brave              # works with any supported browser
htap browser --label "manual testing"     # custom session label
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

## `htap tui`

Open the interactive TUI. See [TUI documentation](tui.md) for keybindings and features.

| Flag   | Description                                 |
| ------ | ------------------------------------------- |
| `--ci` | CI mode: render once and exit (for testing) |

## `htap status`

Show comprehensive status: daemon state, interception state, sessions, request count, loaded interceptors.

## `htap daemon stop`

Stop the daemon.

## `htap daemon restart`

Restart the daemon (or start it if not running).

## `htap requests`

List and filter captured requests. Output is a colour-coded table with short IDs — pipe to other tools or use `--json` for structured output.

```bash
htap requests                              # list recent (default limit 50)
htap requests --method GET,POST            # filter by method
htap requests --status 4xx                 # filter by status range
htap requests --host api.example.com       # filter by host
htap requests --path /api/v2               # filter by path prefix
htap requests --search "keyword"           # substring match on URL
htap requests --search "/users\\/\\d+/"    # regex literal match on URL
htap requests --regex "users/\\d+$"       # regex pattern match on URL
htap requests --since 5m                   # last 5 minutes
htap requests --since yesterday            # since midnight yesterday
htap requests --since 10am --before 11am   # time window
htap requests --header "content-type:application/json"  # header filter
htap requests --intercepted-by mock-users  # interceptor filter
htap requests --saved                       # only saved/bookmarked requests
htap requests --limit 100 --offset 50      # pagination
htap requests --json                       # JSON output
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

### `htap requests search <query>`

Full-text search through body content.

```bash
htap requests search "timeout"                        # search request + response bodies
htap requests search "Bearer " --target request      # request body only
htap requests search "error_code" --target response  # response body only
htap requests search "Alice" --method POST --host api.example.com
```

| Flag              | Description                                           |
| ----------------- | ----------------------------------------------------- |
| `--target <kind>` | `request`, `response`, or `both` (default)            |
| `--limit <n>`     | Max results (default 50)                              |
| `--offset <n>`    | Skip results (default 0)                              |
| `--json`          | JSON output                                           |
| Common filters    | `--method`, `--status`, `--host`, `--path`, etc.      |

### `htap requests query <jsonpath>`

Query JSON bodies using JSONPath expressions (e.g. `$.data.id`). Supports `--value`, `--target` (request/response/both).

### `htap requests count`

Count requests matching the current filters.

### `htap requests clear`

Clear all captured requests. Prompts for confirmation unless `--yes` is passed.

## `htap request <id>`

View a single request in detail. Accepts full UUIDs or abbreviated prefixes (first 7+ characters).

```bash
htap request a1b2c3d              # full detail view
htap request a1b2c3d --json       # JSON output
```

### `htap request <id> body`

Dump the response body to stdout (raw, pipeable). Use `--request` for the request body instead.

```bash
htap request a1b2c3d body                # response body
htap request a1b2c3d body --request      # request body
htap request a1b2c3d body | jq .         # pipe to jq
```

### `htap request <id> export <format>`

Export a request as `curl` or `har`.

```bash
htap request a1b2c3d export curl
htap request a1b2c3d export har
```

## `htap sessions`

List active proxy sessions.

| Flag     | Description |
| -------- | ----------- |
| `--json` | JSON output |

## `htap clear`

Clear all captured requests.

## `htap debug-dump`

Collect diagnostics (system info, daemon status, recent logs) into `.htap/debug-dump-<timestamp>.json`.

## `htap mcp`

Start the MCP server (stdio transport). See [MCP documentation](mcp.md).

## `htap interceptors`

List loaded interceptors, or manage them with subcommands. See [Interceptors documentation](interceptors.md).

### `htap interceptors init`

Scaffold an example interceptor in `.htap/interceptors/`.

### `htap interceptors reload`

Reload interceptors from disk without restarting the daemon.

### `htap interceptors logs`

View the interceptor event log. Events include match results, mock responses, errors, timeouts, and `ctx.log()` output.

```bash
htap interceptors logs                         # recent events
htap interceptors logs --name mock-users       # filter by interceptor
htap interceptors logs --level error           # filter by level
htap interceptors logs --limit 100             # more results
htap interceptors logs --follow                # live tail (Ctrl+C to stop)
htap interceptors logs --follow --json         # live tail as NDJSON
```

| Flag                   | Description                         |
| ---------------------- | ----------------------------------- |
| `--name <interceptor>` | Filter by interceptor name          |
| `--level <level>`      | Filter by level (info, warn, error) |
| `--limit <n>`          | Max events (default 50)             |
| `--follow`             | Live tail — poll for new events     |
| `--json`               | JSON output                         |

### `htap interceptors logs clear`

Clear the interceptor event log.

## `htap completions <shell>`

Generate shell completion scripts. Supports `zsh`, `bash`, and `fish`.

```bash
eval "$(htap completions zsh)"    # add to .zshrc
eval "$(htap completions bash)"   # add to .bashrc
htap completions fish | source    # add to fish config
```
