# htap Development Plan

## Completed

<details>
<summary>Core TUI & CLI (v0.1–v0.2)</summary>

- Request/response body viewing, size display, syntax highlighting
- Accordion UI, JSON explorer, text viewer, export modal (editor/clipboard/file)
- Request filtering (fuzzy search, method, status codes), full URL toggle (`u`)
- Extended navigation (g/G/Ctrl+u/Ctrl+d), mouse support, context-sensitive hints
- Help overlay, loading spinner, min terminal size, focus indicators, status indicators
- Copy body (`y`), copy cURL (`c`), HAR export (`H`)
- Project scoping (`.htap/`), directory override (`--dir`), global instance (`~/`)
- CI publish, npm badges, LICENSE

</details>

<details>
<summary>Phase 1: Read-only MCP — Traffic Inspection</summary>

MCP server (`htap mcp`) connecting to the daemon's control socket for AI-driven traffic inspection.

**Tools:** `htap_get_status`, `htap_list_requests`, `htap_get_request`, `htap_search_bodies`, `htap_query_json`, `htap_count_requests`, `htap_clear_requests`, `htap_list_sessions`

**Filtering:** method, status range, URL, host, path prefix, time window, header name/value/target. Text and JSON output formats.

</details>

<details>
<summary>Phase 2: Config-as-code — Mocks & Interceptors</summary>

TypeScript interceptor files in `.htap/interceptors/` — mock, modify, or observe HTTP traffic via the `forward()` pattern.

- `jiti` TypeScript loader, hot-reload via `fs.watch`, first-match semantics
- `InterceptorContext` with frozen request, `forward()`, `htap` client, `ctx.log()`
- Match timeout (5s), handler timeout (30s), response validation
- MCP tools: `htap_list_interceptors`, `htap_reload_interceptors`, `intercepted_by` filter
- CLI: `htap interceptors list|reload|init`
- TUI: M/I indicators, interceptor badge, detail pane info
- `htap/interceptors` barrel export for consumer types

</details>

<details>
<summary>Bug fixes</summary>

- Mouse wheel scroll confined to request list
- Terminal hyperlink suppression
- Method truncation on long URLs
- Source attribution hardening: internal session headers now require a per-session token, with runtime source taking precedence when available
- Interception marker semantics: `I` now indicates actual response mutation only; observe-only `forward()` interceptors keep attribution without the modified marker
- TUI startup dimension sync: status-hint bar now re-checks terminal size immediately after mount to avoid first-render hint truncation until first keypress

</details>

<details>
<summary>CLI Query Interface</summary>

Scriptable CLI commands exposing the same search/filter/export capabilities as the TUI and MCP. Follows a "gradual discovery" pattern where each command's output hints at related commands.

- `htap requests` — list/filter with `--method`, `--status`, `--host`, `--path`, `--since`/`--before`, `--header`, `--intercepted-by`, `--json`
- Space-separated URL search terms now compose with AND semantics (applies across TUI/CLI/MCP list filtering)
- `htap requests search <query>` — full-text body search
- `htap requests query <jsonpath>` — JSONPath query on bodies
- `htap requests count` — count matching requests
- `htap requests clear` — clear captured requests (with confirmation)
- `htap request <id>` — single request detail (supports abbreviated IDs)
- `htap request <id> body` — dump response body (raw, pipeable); `--request` for request body
- `htap request <id> export curl|har` — export in various formats
- `htap sessions` — list active proxy sessions
- `htap interceptors logs` — event log with `--name`, `--level`, `--follow` (live tail), `--json`
- `htap interceptors logs clear` — clear event log
- `htap completions zsh|bash|fish` — shell completion script generation
- Human-friendly time parser for `--since`/`--before` (5m, 2h, 10am, yesterday, monday, ISO dates)
- Colour-coded output with NO_COLOR/pipe detection; `--json` for machine output

</details>

<details>
<summary>Fake domains / virtual hosts</summary>

Validated support for mocking fully fictional hosts/paths through interceptors, without upstream DNS/TCP success.

- Integration coverage for mocked `http://my-fake-api.local/...` and `https://my-fake-api.local/...`
- Clean failure coverage for unmatched fake-host requests (proxy remains usable)
- Interceptor docs now include a virtual-host mocking example and HTTPS CA trust note

</details>

---

## Up Next

Each feature should be considered across all four surfaces where applicable:

- **TUI** — interactive terminal UI (filter bar, keybindings, modals)
- **CLI** — REST-like commands (`htap requests --flag`)
- **MCP** — AI-facing tools (`htap_list_requests` etc.)
- **API** — programmatic Node.js API (`import { ... } from 'htap'`)

---

- [ ] **TUI request list v2 (high-throughput stability rebuild)** — eliminate flicker/jank under heavy traffic while preserving follow + manual focus workflows ([detailed plan](request-list-v2-plan.md))
  - **Current pain points:** full-list polling with array replacement, index-based re-anchoring in post-render effects, timestamp-only sort instability under same-ms bursts, overlapping poll requests, and uncancelled full-request fetches during fast navigation
  - **Implementation checklist:**
    - [x] Add a monotonic request order key in storage and control responses; sort deterministically (not timestamp-only)
    - [x] Replace `countRequests + listRequestsSummary` polling with single-flight delta sync (`afterSeq`/cursor) and stale-response dropping
    - [ ] Introduce a request-list reducer (`selectedId`, `topVisibleId`, follow state) so selection/scroll anchoring updates atomically
    - [x] Extract request-list state logic into dedicated TUI modules (`hooks/useRequestListState.ts` + `state/request-list-state.ts`) as a precursor to the reducer/store cutover
    - [ ] Add full-request detail cache + stale-response guard so rapid selection changes cannot paint old request details
    - [x] Browse mode viewport freeze + "new items" indicator; follow mode remains explicit and auto-scrolls to newest
    - [ ] Fetch/render only viewport + overscan window, with paged loading for older rows
    - [ ] Split list state/rendering out of `App.tsx` and minimise per-row prop churn
    - [ ] Add burst-load tests (component + integration) for selection stability, ordering stability, and input responsiveness
  - **Validation target:** no visible row jitter/reorder artifacts and responsive key navigation during sustained high request throughput

- [x] **Saved requests (bookmarks)** — save/bookmark individual requests for later reference, persisting them beyond `clear` operations
  - **Storage:** new `saved_requests` table in SQLite (or a `saved` flag on the requests table); saved requests excluded from `clear` by default
  - **TUI:** keybinding (e.g. `b`) to toggle bookmark on selected request, visual indicator on bookmarked rows, filter to show only saved requests
  - **CLI:** `htap requests --saved` filter flag; `htap request <id> save` / `htap request <id> unsave` to toggle
  - **MCP:** `saved` filter param on `htap_list_requests`, `htap_save_request` / `htap_unsave_request` tools

- [x] **Request sources** — automatically identify where requests come from, with optional user override
  - **Daemon:** resolve parent PID to process name on session creation; store `source` on the session; accept `--source` override via `htap on`
  - **TUI:** ~~show source on request list rows~~ source shown in accordion detail panel (Request section); source field in filter bar
  - **CLI:** `--source` filter flag on `htap requests` / `htap sessions`; `htap on --source "dev server"` to set manually
  - **MCP:** `source` filter param on `htap_list_requests` / `htap_list_sessions`

- [x] **Regexp filter** — support regex patterns in search/filter across all surfaces
  - **TUI:** detect `/pattern/` syntax in the filter bar search field, apply as regex match on URL
  - **CLI:** `--search` accepts `/pattern/` for regex, or a `--regex` flag
  - **MCP:** `regex` param on `htap_list_requests` / `htap_search_bodies`
  - **Implementation checklist:**
    - [x] **Shared filter contract + parser helpers**
      - Extend `RequestFilter` with `regex?: string`
      - Add shared helper(s) to parse `/pattern/` literals and validate regex safely (`try/catch`)
    - [x] **Daemon/control/storage support**
      - Accept `filter.regex` in `src/daemon/control.ts` (`optionalFilter`)
      - Add regex condition support in `src/daemon/storage.ts` filter application
      - Ensure invalid regex yields a clear error (no crash)
    - [x] **CLI wiring (`htap requests`)**
      - Add `--regex <pattern>` flag in `src/cli/commands/requests.ts`
      - Support `/pattern/` auto-detection in `--search`
      - Keep non-regex search semantics unchanged (space-separated terms = AND)
    - [x] **TUI wiring (filter bar + list highlighting)**
      - Parse `/pattern/` in `src/cli/tui/components/FilterBar.tsx`
      - Preserve existing debounce/live-apply behaviour
      - Disable substring highlight in `RequestListItem` when search is in regex mode
    - [x] **MCP schema + filter builder updates**
      - Add `regex` param to `htap_list_requests` + `htap_search_bodies`
      - Pass through in `buildFilter(...)` in `src/mcp/server.ts`
    - [x] **Tests**
      - Daemon storage: regex match/no-match/invalid/combined filters
      - TUI FilterBar: `/pattern/` emits regex filter
      - MCP: `buildFilter` + integration coverage for `regex` param
      - CLI integration: `--search '/.../'` and `--regex` behaviour
    - [x] **Docs follow-up**
      - Update CLI/MCP filter docs + examples
      - Mark this item complete in `docs/PLAN.md` once shipped

- [x] **Targeted body search across all surfaces (request vs response)** — body search supports selecting request body, response body, or both
  - **Goal:** avoid wasteful dual-body scans when only one side is relevant, while preserving backwards compatibility
  - **Behaviour contract:**
    - `target=both` remains default (existing behaviour)
    - Explicit `target=request` and `target=response`
  - **CLI:** `htap requests search <query> --target request|response|both`
  - **MCP:** `htap_search_bodies` supports optional `target` enum (`request` | `response` | `both`)
  - **TUI:** no new keybinding; filter-bar scope syntax
    - Default (unchanged): `foo` → URL/path search
    - `body:foo` → body search (`both`)
    - `body:req:foo` / `body:request:foo` → request-body only
    - `body:res:foo` / `body:response:foo` → response-body only
  - **Implementation checklist:**
    - [x] Extend shared body-search contract to include `target?: "request" | "response" | "both"` (default `both`)
    - [x] Update daemon control API validation + forwarding for body-search target
    - [x] Update storage `searchBodies(...)` SQL builder to apply body-match conditions by target (request-only/response-only/both)
    - [x] Keep text-content-type safety rules per-side (don’t search binary content-types)
    - [x] CLI: add `--target` parsing/validation, wiring, and help text
    - [x] MCP: add `target` schema/docs in `htap_search_bodies`, pass through to client
    - [x] TUI: add search-prefix parser for body scope + target, route to body-search path without adding a keybinding
    - [x] Keep existing debounce/live filter UX and regex error resilience
    - [x] Tests: storage target semantics, control-client/control-server wiring, CLI flag behaviour, MCP param behaviour, TUI scope parsing and rendering
    - [x] Docs: update CLI reference, MCP docs, TUI help/README/wiki examples

- [x] **TUI body-search discoverability polish (lightweight)** — make `body:` search obvious without adding keybindings or complex UI
  - **Constraints:** no new keybindings; keep interaction model simple
  - **Shipped:**
    - Highlight `body:` prefix (and optional target token like `req:`/`res:`) while typing in `/` filter bar
    - Improved filter-bar hint text with explicit body-search example (`body:req:error`)
    - Improved help/discovery copy (`/` action now mentions URL, regex, and body filter syntax)
    - Updated TUI docs with an explicit highlighting tip
  - **Out of scope (for this pass):** mode badges, extra panels, or advanced filter UX rework
  - **Validation:** TUI component tests for prefix parsing/rendering + help copy updates

- [x] **Remove `htap init`** — replaced `init`/`vars` with `htap on`/`htap off` as real CLI subcommands

- [x] **Simplify README** — current README is ~700 lines; trim to quick-start + feature highlights + architecture diagram and move detailed reference (MCP tools/filters, full keybindings, CLI reference, interceptor cookbook) to a GitHub wiki. Inspiration: [sql-tap](https://github.com/mickamy/sql-tap) keeps its README short and scannable

- [x] **CLI query interface** — see Completed section above

- [ ] **TUI layout: full-width list + resizable panels** — improve panel layout when no request is selected and allow dynamic resizing
  - When no request is selected, the request list should expand to fill the entire screen (no empty detail pane)
  - Resizable panels (zellij-style): allow dragging or keybinding-based resizing of the request list / detail pane split

- [ ] **Programmatic Node.js API** — `npm install htap` and use from a script; fourth surface alongside TUI/CLI/MCP
  - **Why:** htap will be composed with other packages (SQL proxy, logger, OTEL tool) into a larger toolkit; needs to be embeddable, not just a standalone CLI
  - Public API exported from `htap` package entry point (e.g. `import { createProxy, ... } from 'htap'`)
  - Start/stop daemon programmatically, configure proxy settings, register interceptors
  - Query captured traffic (list, filter, search, get request detail)
  - Event-based hooks (on request captured, on interceptor match, etc.)
  - Manage interceptors (load, reload, write, delete)
  - Replay requests
  - Clean separation from CLI — API should not depend on commander/ink

---

## Phase 3: MCP Write — Request Replay + AI-driven Interceptors

**Goals:** add safe MCP write operations and a deliberate replay UX in the TUI.

### 3.1 Replay request (`htap_replay_request`)

- [x] Add `htap_replay_request` MCP tool to replay a captured request by ID
  - Required: `id`
  - Optional overrides: `method`, `url`, header upserts/removals, `body` (text), `body_base64` (binary), `timeout_ms`
  - Return: new request ID + replay summary
- [x] Replays must flow through normal proxy capture/interceptor path so replayed traffic appears in captured requests like any other request
- [x] Persist replay metadata on replayed requests (for visibility across surfaces)
  - `replayed_from_id`
  - `replay_initiator` (`mcp` | `tui`)

### 3.2 Interceptor file write/delete tools

- [x] Add `htap_write_interceptor` MCP tool
  - Writes/updates `.htap/interceptors/*.ts`
  - Path safety: must remain under interceptors dir, no traversal, `.ts` only
  - Supports explicit overwrite mode
  - Triggers interceptor reload and returns reload status/errors
- [x] Add `htap_delete_interceptor` MCP tool
  - Deletes `.htap/interceptors/*.ts`
  - Same path safety constraints
  - Triggers interceptor reload and returns reload status/errors

### 3.3 TUI replay (explicit confirmation required)

- [x] Add one-key replay action for selected request (`R`)
- [x] **Hard confirmation required** before replay executes
  - Prompt: `Replay selected request? (y to confirm, any key to cancel)`
  - `y` confirms; any other key cancels
- [x] Show replay progress/result status messages (`Replaying...`, success/failure)
- [x] Replayed request must appear in the request list after completion

### 3.4 Replay visualisation

- [x] Mark replayed requests with a dedicated list indicator (e.g. `R`/`[R]`)
- [x] Show replay lineage in request detail pane (`Replayed from: <id>`, initiator)
- [x] Keep existing interception (`M`/`I`) and saved (`*`/`[S]`) indicators readable alongside replay marker

### 3.5 Tests

- [x] Storage/control tests for replay metadata persistence + replay API validation
- [x] MCP server tests for new tool schemas, happy paths, and error paths
- [x] Path-safety tests for interceptor write/delete tools (invalid path, traversal, wrong extension)
- [x] TUI component tests for replay confirmation flow (`R` → `y` confirm / cancel on other key)
- [x] Integration test verifying replayed request is captured and marked as replayed

### 3.6 Docs

- [x] Update `docs/mcp.md` with new write tools + examples
- [x] Update TUI docs/help text for replay key + confirmation behaviour + replay marker legend

---

## Phase 4: Additional Export Formats

Extend the existing cURL export (`c` key) with more formats.

- [x] `fetch` — JavaScript Fetch API
- [x] `requests` — Python requests library
- [x] `httpie` — HTTPie CLI

New formatter functions alongside existing `generateCurl()`. Submenu or modal for format selection.

---

## Phase 5: Remaining Features

- [ ] **WebSocket support** — Capture and display WebSocket traffic (frames, messages, connection lifecycle)
- [x] **Launch browser** — `htap browser [url]` spawns a browser pre-configured to use the proxy with the CA cert trusted
  - **Chrome/Chromium:** `--proxy-server` and `--ignore-certificate-errors-spki-list` flags, isolated profile via `--user-data-dir`, MV3 extension for session header injection
  - **Firefox:** fresh profile with proxy prefs via `user.js`, MV2 webRequest extension for session header injection, `--no-remote` for isolation
  - **Safari:** deferred — requires system-wide proxy settings and macOS Keychain CA trust (elevated permissions)
  - Auto-detect installed browsers; `--browser` flag for override; session attribution via browser extension
- [ ] **Cross-platform CI** — Run integration tests across platforms via GitHub Actions

---

## Runtime-specific Proxy Overrides

Many runtimes don't respect `HTTP_PROXY`/`HTTPS_PROXY` out of the box. htap injects preload scripts or agent configuration per-runtime to ensure traffic flows through the proxy.

| Runtime     | Mechanism                                                       | Status      | Notes                                                                  |
| ----------- | --------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| **Node.js** | `NODE_OPTIONS --require` preload with `global-agent` + `undici` | **Done**    | Covers `http`/`https` modules + native `fetch()`                       |
| **Python**  | `PYTHONPATH` sitecustomize.py that patches `httplib2`           | **Done**    | `requests`/`urllib3` respect env vars; override handles httplib2       |
| **Ruby**    | `RUBYOPT -r` preload that patches `OpenSSL::X509::Store`        | **Done**    | Ensures gems with bundled CAs trust the proxy CA                       |
| **PHP**     | `PHP_INI_SCAN_DIR` with `curl.cainfo`/`openssl.cafile`          | **Done**    | Covers `curl_*()` functions and stream wrappers                        |
| **Go**      | Env vars only (`SSL_CERT_FILE`)                                 | **Done**    | Go's `net/http` respects `HTTP_PROXY`/`HTTPS_PROXY` natively           |
| **Rust**    | Env vars only (`CARGO_HTTP_CAINFO`)                             | **Done**    | `reqwest` respects env vars natively                                   |
| **Deno**    | Env vars only (`DENO_CERT`)                                     | **Done**    | Deno respects proxy env vars natively                                  |
| **Bun**     | Env vars only (`SSL_CERT_FILE`)                                 | **Done**    | Bun respects proxy env vars natively                                   |
| **Java**    | Not supported                                                   | Not planned | Needs `-javaagent` or JVM trust store — can't solve via env vars alone |
| **Swift**   | Not supported                                                   | Not planned | Uses macOS Keychain only                                               |
| **Dart**    | Not supported                                                   | Not planned | Requires code changes for proxy                                        |
| **Elixir**  | Not supported                                                   | Not planned | Requires code changes for proxy                                        |

---

## Maybe (parked)

- [ ] **Drop mockttp** — Replace with custom MITM for Bun portability
- [ ] **AI request visualisation** — Detect OpenAI/Anthropic/etc. API patterns; render token counts, model info, streaming chunks
- [ ] **Full system proxy** — Act as system-wide proxy, not just per-shell
- [ ] **OTEL support** — OpenTelemetry trace correlation

---

## Docs & Landing Page (separate effort, later)

- [ ] llms.txt
- [ ] Searchable docs
- [ ] Use cases (AI traffic analysis, debugging, etc.)
- [ ] Recipes — practical complex scenarios front and centre
