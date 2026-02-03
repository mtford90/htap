# htpx Post-Release Tasks

## Phase 5: Polish & CI Publishing

### Tasks

- [x] **1. Add LICENSE file** - Create MIT license file
- [x] **2. Add npm badge to README** - Show version/downloads badges
- [x] **3. Test global install** - Verify `npm install -g htpx-cli` works end-to-end
- [x] **4. Set up npm publish in CI** - Auto-publish on version tags
- [ ] **5. New features** - See options below

---

## Feature Options (Task 5)

Potential features to implement - priority TBD:

- [ ] **a) Request filtering/search in TUI** - Filter by URL, method, status code
- [ ] **b) Response body viewing** - View response bodies in detail pane
- [ ] **c) Request/response size display** - Show payload sizes in list and details
- [ ] **d) WebSocket support** - Capture and display WebSocket traffic
- [ ] **e) Request replay** - Replay captured requests with optional modifications
- [ ] **f) Export improvements** - More export formats, batch export options

---

## Completed

- [x] **1. Add LICENSE file** - MIT license added
- [x] **2. Add npm badges** - Version, CI, license badges in README
- [x] **3. Test global install** - `npm install -g htpx-cli` works
- [x] **4. Set up npm publish in CI** - Auto-publish on `v*` tags (requires `NPM_TOKEN` secret)
