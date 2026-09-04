# TUI

[Back to README](../README.md) | [CLI Reference](cli-reference.md)

Open the interactive TUI with `httap tui`.

`j`/`k` to navigate, `Tab` to switch panels, `/` to filter, `e` to export, `Enter` to inspect bodies, `q` to quit.

Mouse support: click to select, scroll to navigate, click panels to focus.

## Runtime

The TUI is rendered by [OpenTUI](https://opentui.com), whose native library is
loaded through `node:ffi`. Node gates that module behind `--experimental-ffi`
until it is enabled by default; the installed `httap` binary sets that flag in
its own shebang, so the CLI process renders the TUI itself. That flag needs
Node 26.4 or newer, which is httap's minimum version anyway; on anything older
`httap tui` says so and exits.

Set `HTTAP_TUI=ink` to run the previous Ink interface instead. That escape
hatch exists for one minor release and is removed with the Ink tree.

## Main View

### Navigation

| Key                  | Action                                                                     |
| -------------------- | -------------------------------------------------------------------------- |
| `j`/`k` or `↑`/`↓`  | Navigate up/down                                                           |
| `g` / `G`            | Jump to first / last item (`g` also enters follow mode)                    |
| `F`                  | Toggle follow mode (auto-select newest request)                            |
| `Ctrl+u` / `Ctrl+d`  | Half-page up / down                                                        |
| `Ctrl+f` / `Ctrl+b`  | Full-page down / up                                                        |
| `Tab` / `Shift+Tab`  | Next / previous panel                                                      |
| `1`-`5`              | Jump to section (list / request / request body / response / response body) |
| `Space`              | Toggle section expand/collapse (accordion panel)                           |
| `[` / `]`            | Resize panels (shrink / grow list)                                         |
| `=`                  | Reset panel size to default                                                |

### Actions

| Key     | Action                                              |
| ------- | --------------------------------------------------- |
| `Enter` | Open body in full-screen viewer                     |
| `e`     | Export request (opens format picker modal)           |
| `R`     | Replay request (with confirmation)                  |
| `y`     | Copy body to clipboard                              |
| `s`     | Export body content (opens destination picker modal) |
| `b`     | Toggle bookmark on selected request                 |
| `x`/`D` | Clear requests (with confirmation)                  |
| `/`     | Open filter bar                                     |
| `u`     | Toggle full URL display                             |
| `r`     | Refresh                                             |
| `L`     | Interceptor event log                               |
| `?`     | Help                                                |
| `q`     | Quit                                                |

### Follow Mode

By default the TUI starts in **follow mode** — the cursor automatically tracks the newest request as traffic arrives, similar to `tail -f`. The `[FOLLOWING]` badge appears in the status bar.

- Any `j`/`k` navigation exits follow mode, anchoring the cursor to the current request by ID. New requests arriving will not move the cursor.
- Scrolling the list with the mouse wheel also exits follow mode and leaves the viewport where you scrolled it.
- Press `F` to toggle follow mode back on (jumps to the newest request).
- Press `g` (go to top) to re-enter follow mode.

## Filter Bar (`/`)

| Key                 | Action                                                               |
| ------------------- | -------------------------------------------------------------------- |
| `Tab` / `Shift+Tab` | Cycle between search, method, status, saved, source fields                |
| `←` / `→`           | Cycle method/status/saved values when those fields are focused             |
| `Return`            | Close filter bar (filters are already applied live while typing)           |
| `Esc`               | Cancel and revert to the pre-open filter state                             |

Search field supports:

- URL search (default): `users api` or regex literal `/users\/\d+/i`
- Body search (both): `body:error`
- Request-body only: `body:req:error` (or `body:request:error`)
- Response-body only: `body:res:error` (or `body:response:error`)

Tip: when the search text is a `body:` filter, the whole search field turns cyan.

## JSON Explorer (Enter on a JSON body)

| Key         | Action                |
| ----------- | --------------------- |
| `j`/`k`     | Navigate nodes        |
| `Enter`/`l` | Expand/collapse node  |
| `h`         | Collapse node         |
| `e` / `c`   | Expand / collapse all |
| `/`         | Filter by path        |
| `n` / `N`   | Next / previous match |
| `y`         | Copy value            |
| `q` / `Esc` | Close                 |

## Text Viewer (Enter on a non-JSON body)

| Key         | Action                |
| ----------- | --------------------- |
| `j`/`k`     | Scroll line by line   |
| `Space`     | Page down             |
| `g` / `G`   | Top / bottom          |
| `/`         | Search text           |
| `n` / `N`   | Next / previous match |
| `y`         | Copy to clipboard     |
| `q` / `Esc` | Close                 |

## Export

### Export request (`e`)

Press `e` to open the export modal. Select a format:

| Option   | Action                                    |
| -------- | ----------------------------------------- |
| cURL     | Copy as curl command to clipboard         |
| Fetch    | Copy as JavaScript fetch to clipboard     |
| Python   | Copy as Python requests to clipboard      |
| HTTPie   | Copy as HTTPie command to clipboard       |
| HAR      | Save the selected request as a HAR file   |

Selecting HAR opens a destination picker — `.httap/exports/`, `~/Downloads/`, or a custom directory path.

### Export body (`s`)

Press `s` on a body section to open the body export modal — clipboard, `.httap/exports/`, `~/Downloads/`, custom path, or open in default application.
