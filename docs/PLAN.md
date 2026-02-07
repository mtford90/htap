# htpx Development Plan

## Next Up (Definites)

- [x] **Full URL in request list** - Toggle full URL display with `u` key
- [x] **Request/response body viewing** - Stack/accordion UI in details pane to view request body and response body (tab through sections)
- [x] **Request/response size display** - Show payload sizes in list and details
- [ ] **Request filtering** - Filter requests by:
  - Fuzzy search (URL, headers, body)
  - HTTP method
  - Status codes
- [ ] **Publish proxy details** - Allow proxy to be used anywhere, not just via `eval $(htpx intercept)` on CLI
- [ ] **Support any directory** - Allow running htpx in any dir; climb to `~/` if no project/git root found (generic proxy across projects)
- [x] **Mouse support** - Click to select requests, panels, etc. (like neovim/zellij)
- [ ] manipulate/explore request/response bodies e.g. if JSON
- [ ] when focused on e.g. request body, allow for opening in system editor, or copy to clipboard - same for other panels - we might need a modal thing to allow choosing how to export
- [ ] pretty request/response
- [ ] syntax highlighting for request/response
- [ ] copy request/response body when focused

---

## Future

- [ ] **MCP/skill support** - Allow Claude to discover `.htpx` and communicate with proxy; provide search tools (search through request/response body, URL, headers, etc.)
- [ ] **More export formats** - e.g. fetch, Python requests
- [ ] **Request replay** - Replay captured requests with optional modifications
- [ ] **WebSocket support** - Capture and display WebSocket traffic
- [ ] **Aggregate mode** - Instead of showing requests one-by-one, aggregate by method, domain, path, etc.
- [ ] **Launch Chromium** - Spawn Chromium instance pre-configured to use the proxy

## Landing page & docs

- [ ] llms.txt
- [ ] searchable docs?
- [ ] use cases e.g. ai can analyse requests being sent, get full picture

## Bugs

- [ ] i can't save json - save only seems to work for binary files

---

## Maybe

- [ ] **Drop mockttp** - mockttp doesn't support Bun; dropping it would enable Bun portable executables instead of npm (note: htpx doesn't need mock functionality)

## Completed

- [x] Add LICENSE file (MIT)
- [x] Add npm badges to README
- [x] Test global install (`npm install -g htpx-cli`)
- [x] Set up npm publish in CI (auto-publish on `v*` tags)
- [x] Improve `htpx intercept` UX - detect direct vs eval usage
- [x] Copy curl to clipboard instead of printing after TUI exit
