# procsi Development Plan

## Completed

<details>
<summary>Core TUI & CLI (v0.1–v0.2)</summary>

- Request/response body viewing, size display, syntax highlighting
- Accordion UI, JSON explorer, text viewer, export modal (editor/clipboard/file)
- Request filtering (fuzzy search, method, status codes), full URL toggle (`u`)
- Extended navigation (g/G/Ctrl+u/Ctrl+d), mouse support, context-sensitive hints
- Help overlay, loading spinner, min terminal size, focus indicators, status indicators
- Copy body (`y`), copy cURL (`c`), HAR export (`H`)
- Project scoping (`.procsi/`), directory override (`--dir`), global instance (`~/`)
- CI publish, npm badges, LICENSE

</details>

<details>
<summary>Phase 1: Read-only MCP — Traffic Inspection</summary>

MCP server (`procsi mcp`) connecting to the daemon's control socket for AI-driven traffic inspection.

**Tools:** `procsi_get_status`, `procsi_list_requests`, `procsi_get_request`, `procsi_search_bodies`, `procsi_query_json`, `procsi_count_requests`, `procsi_clear_requests`, `procsi_list_sessions`

**Filtering:** method, status range, URL, host, path prefix, time window, header name/value/target. Text and JSON output formats.

</details>

<details>
<summary>Phase 2: Config-as-code — Mocks & Interceptors</summary>

TypeScript interceptor files in `.procsi/interceptors/` — mock, modify, or observe HTTP traffic via the `forward()` pattern.

- `jiti` TypeScript loader, hot-reload via `fs.watch`, first-match semantics
- `InterceptorContext` with frozen request, `forward()`, `procsi` client, `ctx.log()`
- Match timeout (5s), handler timeout (30s), response validation
- MCP tools: `procsi_list_interceptors`, `procsi_reload_interceptors`, `intercepted_by` filter
- CLI: `procsi interceptors list|reload|init`
- TUI: M/I indicators, interceptor badge, detail pane info
- `procsi/interceptors` barrel export for consumer types

</details>

<details>
<summary>Bug fixes</summary>

- Mouse wheel scroll confined to request list
- Terminal hyperlink suppression
- Method truncation on long URLs

</details>

---

## Up Next

- [ ] **Labels** — tag/label requests or sessions for organisation and filtering
- [ ] **Regexp filter** — support regex patterns in the filter bar
- [ ] **Multiple filters** — compose filters (e.g. filter by `bigcommerce` AND `variants`)
- [ ] **TUI body search** — search through request/response bodies from within the TUI (not just MCP)
- [ ] **Remove `procsi init`** — internalise initialisation; `procsi init` sounds important but does nothing the auto-init doesn't already handle

---

## Phase 3: MCP Write — Request Replay + AI-driven Interceptors

**New MCP tools:**

- [ ] `procsi_replay_request` — replay a captured request with optional modifications (URL, headers, body, method)
- [ ] `procsi_write_interceptor` — AI writes/updates interceptor `.ts` files, triggers reload
- [ ] `procsi_delete_interceptor` — remove an interceptor file

**TUI replay:**

- Simple one-key resend of the selected request (no editing — cURL export covers modification use cases)

---

## Phase 4: Additional Export Formats

Extend the existing cURL export (`c` key) with more formats.

- [ ] `fetch` — JavaScript Fetch API
- [ ] `requests` — Python requests library
- [ ] `httpie` — HTTPie CLI

New formatter functions alongside existing `generateCurl()`. Submenu or modal for format selection.

---

## Phase 5: Remaining Features

- [ ] **WebSocket support** — Capture and display WebSocket traffic (frames, messages, connection lifecycle)
- [ ] **Launch Chromium** — `procsi chrome` spawns Chromium pre-configured to use the proxy
- [ ] **Cross-platform CI** — Run integration tests across platforms via GitHub Actions

---

## Runtime-specific Proxy Overrides

Many runtimes don't respect `HTTP_PROXY`/`HTTPS_PROXY` out of the box. procsi injects preload scripts or agent configuration per-runtime to ensure traffic flows through the proxy.

| Runtime     | Mechanism                                                       | Status   | Notes                                                                    |
| ----------- | --------------------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| **Node.js** | `NODE_OPTIONS --require` preload with `global-agent` + `undici` | **Done** | Covers `http`/`https` modules + native `fetch()`                         |
| **Ruby**    | `RUBYLIB` override with gem that patches `Net::HTTP`            | Future   | Ruby's `Net::HTTP` doesn't respect `HTTP_PROXY` by default               |
| **Python**  | `PYTHONPATH` override with package patches                      | Future   | `requests`/`urllib3` already respect env vars; stdlib `urllib` doesn't   |
| **Java**    | `JAVA_TOOL_OPTIONS -javaagent:` with proxy agent JAR            | Future   | Java needs system properties (`http.proxyHost`) — env vars aren't enough |
| **PHP**     | `PHP_INI_SCAN_DIR` with custom php.ini                          | Future   | PHP needs stream context config for proxy                                |
| **Go**      | No action needed                                                | N/A      | Go's `net/http` respects `HTTP_PROXY`/`HTTPS_PROXY` natively             |
| **Rust**    | No action needed                                                | N/A      | `reqwest` respects env vars natively                                     |
| **Deno**    | Certificate trust only (`DENO_CERT`)                            | Future   | Deno respects proxy env vars natively                                    |

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
