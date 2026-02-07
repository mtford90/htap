# htpx Development Plan

## Next Up (Definites)

- [x] **Full URL in request list** - Toggle full URL display with `u` key
- [x] **Request/response body viewing** - Stack/accordion UI in details pane to view request body and response body (tab through sections)
- [x] **Request/response size display** - Show payload sizes in list and details
- [ ] **Request filtering** - Filter requests by:
  - Fuzzy search (URL, headers, body)
  - HTTP method
  - Status codes
- [ ] **Publish proxy details** - Show connection details so the proxy can be used anywhere, not just via `eval $(htpx intercept)` on CLI
- [ ] **Support any directory** - Allow running htpx in any dir; climb to `~/` if no project/git root found (generic proxy across projects)
- [ ] **Directory scope override** - Pass a parameter to htpx CLI allowing override of cwd (currently uses .git or current dir)
- [ ] **Global htpx instance** - Support `~/` scope for a global htpx instance that works across all projects
- [ ] **Full system proxy** - Support for acting as a full system proxy (not just per-shell)
- [x] **Mouse support** - Click to select requests, panels, etc. (like neovim/zellij)
- [ ] manipulate/explore request/response bodies e.g. if JSON
- [ ] when focused on e.g. request body, allow for opening in system editor, or copy to clipboard - same for other panels - we might need a modal thing to allow choosing how to export
- [ ] pretty request/response
- [ ] syntax highlighting for request/response
- [ ] copy request/response body when focused

---

## Future

- [ ] **Mocks & interceptors as code** - TypeScript config files inside `.htpx/` that define middleware/intercept/mock behaviour. Middleware receives an htpx client with full power (searching, filtering, modifying requests/responses). The TUI highlights and displays what's configured, but the actual logic lives in `.htpx/`. Mocking scenarios become infinite — needs timeouts and safeguards to avoid lockups and performance issues
- [ ] **MCP support for mocks/interceptors** - Explicit MCP integration so you can ask your AI to write and manage mock/intercept rules via the `.htpx/` config-as-code system
- [ ] **MCP/skill support** - Allow Claude to discover `.htpx` and communicate with proxy; provide search tools (search through request/response body, URL, headers, etc.)
- [ ] **More export formats** - e.g. fetch, Python requests
- [ ] **Request replay** - Replay captured requests with optional modifications
- [ ] **WebSocket support** - Capture and display WebSocket traffic
- [ ] **Aggregate mode** - Instead of showing requests one-by-one, aggregate by method, domain, path, etc.
- [ ] **Launch Chromium** - Spawn Chromium instance pre-configured to use the proxy
- [ ] **Cross-platform CI integration testing** - Run htpx integration tests across platforms via GitHub Actions CI

## Landing page & docs

- [ ] llms.txt
- [ ] searchable docs?
- [ ] use cases e.g. ai can analyse requests being sent, get full picture
- [ ] **Recipes (front & centre!)** - Practical, complex scenarios showcased prominently:
  - "After a request has been sent to this domain 5 times, only return 429 for that domain"
  - "Every 5 requests return a 429 or 500 to simulate API unreliability" (chaos monkey)
  - Complex mocking scenarios demonstrating the config-as-code power

## Bugs

- [ ] i can't save json - save only seems to work for binary files

---

## Maybe

- [ ] **Drop mockttp** - mockttp doesn't support Bun; dropping it would enable Bun portable executables instead of npm (note: htpx doesn't need mock functionality)
- [ ] **AI request visualisation** - Special visualisation for AI/LLM requests (detect OpenAI, Anthropic, etc. API patterns and render token counts, model info, streaming chunks, etc.)
- [ ] **OTEL support** - OpenTelemetry integration for trace correlation and observability

## Completed

- [x] Add LICENSE file (MIT)
- [x] Add npm badges to README
- [x] Test global install (`npm install -g htpx-cli`)
- [x] Set up npm publish in CI (auto-publish on `v*` tags)
- [x] Improve `htpx intercept` UX - detect direct vs eval usage
- [x] Copy curl to clipboard instead of printing after TUI exit
- [x] **UX/UI fixes (7.1–7.8)**: Help overlay (?), extended navigation (g/G/Ctrl+u/Ctrl+d), loading spinner, minimum terminal size check, focus indicator (» + bold), empty state guidance, status indicators (✓/→/✗), DELETE method magenta colour
