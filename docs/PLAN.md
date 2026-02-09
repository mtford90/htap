# htpx Development Plan

## Completed

- [x] Add LICENSE file (MIT)
- [x] Add npm badges to README
- [x] Test global install (`npm install -g htpx-cli`)
- [x] Set up npm publish in CI (auto-publish on `v*` tags)
- [x] Improve `htpx intercept` UX - detect direct vs eval usage
- [x] Copy curl to clipboard instead of printing after TUI exit
- [x] **UX/UI fixes (7.1–7.8)**: Help overlay (?), extended navigation (g/G/Ctrl+u/Ctrl+d), loading spinner, minimum terminal size check, focus indicator (» + bold), empty state guidance, status indicators (✓/→/✗), DELETE method magenta colour
- [x] **Code review fixes (2026-02-07)**: All 24 items addressed — shared `getGlobalOptions` helper, FilterBar lifecycle/cast fixes, `isFilterActive` extraction + tests, JSON pretty-print tests, body preview truncation, DB indices, search length bounds, cursor indicator, and more
- [x] Full URL in request list — toggle with `u` key
- [x] Request/response body viewing — accordion UI in details pane
- [x] Request/response size display — payload sizes in list and details
- [x] Request filtering — fuzzy search, HTTP method, status codes
- [x] Publish proxy details — show connection details for use anywhere
- [x] Support any directory — climb to `~/` if no project/git root found
- [x] Directory scope override — `--dir` flag
- [x] Global htpx instance — `~/` scope
- [x] Mouse support — click to select requests, panels, etc.
- [x] JSON explorer — manipulate/explore request/response bodies
- [x] Export modal — open in editor, copy to clipboard, save to file
- [x] Pretty request/response with syntax highlighting
- [x] Copy request/response body when focused
- [x] Context-sensitive status bar hints
- [x] Text viewer modal

---

## Phase 1: Read-only MCP — Traffic Inspection ✓

Let AI discover `.htpx/` and inspect captured traffic. No mocking yet — purely read-only.

**Tools:**
- [x] `htpx_get_status` — proxy status, port, captured request count
- [x] `htpx_list_requests` — search/filter captured requests (by URL, method, status, headers)
- [x] `htpx_get_request` — fetch full request details (headers, body, timing)
- [x] `htpx_search_bodies` — full-text search through request/response body content
- [x] `htpx_query_json` — extract values from JSON bodies using JSONPath expressions
- [x] `htpx_count_requests` — count requests matching a filter
- [x] `htpx_clear_requests` — delete all captured requests
- [x] `htpx_list_sessions` — list active proxy sessions

**Filtering:** All query tools support method, status range (Nxx patterns), URL search, host, path prefix, time window, header name/value/target. Text and JSON output formats.

**Architecture:**
- MCP server connects to the daemon's existing control socket
- Reuses existing SQLite query infrastructure from the TUI's data layer
- Ships as `htpx mcp` subcommand (stdio-based MCP server)
- Content-type columns added to DB for efficient body search filtering
- Header filtering via `json_extract()` on stored JSON header columns
- JSON body querying via `json_extract(CAST(body AS TEXT), ?)` with content-type gating
- README documented with setup, tool reference, filtering guide, and example workflows
- Code review completed and all findings addressed

---

## Phase 2: Config-as-code — Mocks & Interceptors ✓

TypeScript config files in `.htpx/interceptors/` that can mock, modify, or observe HTTP traffic with full access to htpx's query API.

**API — the `forward()` pattern:**
- [x] Three execution modes from one `handler` function: Mock (return without forward), Modify (call forward + alter), Observe (call forward + return unchanged)
- [x] `InterceptorContext` with frozen request, `forward()`, `htpx` client, `ctx.log()`
- [x] First-match semantics — files loaded alphabetically, first matching interceptor wins
- [x] Safety: match timeout (5s), handler timeout (30s), response validation, stale entry cleanup

**Infrastructure:**
- [x] `jiti` runtime TypeScript loader for `.ts` interceptor files
- [x] `interceptor-loader.ts` — scan, load, validate, hot-reload with `fs.watch`
- [x] `interceptor-runner.ts` — deferred `forward()` pattern bridging mockttp's beforeRequest/beforeResponse
- [x] `htpx-client.ts` — in-process wrapper around `RequestRepository` for interceptor query access
- [x] DB migration v5 — `intercepted_by` and `interception_type` columns
- [x] `InterceptorInfo`, `InterceptionType` types; extended `CapturedRequest`, `CapturedRequestSummary`, `DaemonStatus`, `RequestFilter`

**MCP tools:**
- [x] `htpx_list_interceptors` — list loaded interceptors with status
- [x] `htpx_reload_interceptors` — hot-reload interceptors from disk
- [x] Extended `htpx_list_requests`, `htpx_get_request`, `htpx_count_requests`, `htpx_search_bodies` with `intercepted_by` filter
- [x] Interception metadata (`[M]`/`[I]` indicators) in text and JSON output

**CLI:**
- [x] `htpx interceptors list` — table of loaded interceptors
- [x] `htpx interceptors reload` — trigger reload
- [x] `htpx interceptors init` — scaffold example interceptor file
- [x] `htpx intercept` — reports interceptor count on startup

**TUI:**
- [x] M/I indicator column in request list (magenta/cyan)
- [x] `[N interceptors]` badge in status bar
- [x] "Intercepted by" info in detail pane

**Type exports:**
- [x] `htpx-cli/interceptors` barrel export for consumer type imports

---

## Phase 3: MCP Write — Request Replay + AI-driven Interceptors

Extend MCP with write operations for request replay and AI-assisted interceptor management.

**New MCP tools:**
- [ ] `htpx_replay_request` — replay a captured request with optional modifications (URL, headers, body, method)
- [ ] `htpx_write_interceptor` — AI writes/updates interceptor `.ts` files, triggers reload
- [ ] `htpx_delete_interceptor` — remove an interceptor file

**TUI replay:**
- Simple one-key resend of the selected request (no editing — cURL export covers modification use cases)

---

## Phase 4: Additional Export Formats

Extend the existing cURL export (`c` key) with more formats.

**Formats:**
- [ ] `fetch` — JavaScript Fetch API
- [ ] `requests` — Python requests library
- [ ] `httpie` — HTTPie CLI

**Implementation:**
- New formatter functions alongside existing `generateCurl()`
- Either a submenu on `c` key or separate keys/modal for format selection

---

## Phase 5: Remaining Features

- [ ] **WebSocket support** — Capture and display WebSocket traffic (frames, messages, connection lifecycle)
- [ ] **Launch Chromium** — `htpx chrome` spawns Chromium pre-configured to use the proxy
- [ ] **Cross-platform CI** — Run integration tests across platforms via GitHub Actions

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
