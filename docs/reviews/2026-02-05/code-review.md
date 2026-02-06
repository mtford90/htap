# htpx Code Review - 2026-02-05

Comprehensive code review conducted across 8 dimensions using parallel opus agents.

## Progress

- [ ] **1. React/Ink Best Practices** (5 issues)
- [ ] **2. TypeScript Quality** (4 issues)
- [ ] **3. Code Completeness** (7 issues)
- [ ] **4. Test Coverage** (5 issues)
- [ ] **5. Project Organisation** (4 issues)
- [ ] **6. Security** (4 issues)
- [ ] **7. UX/UI Principles** (8 issues)
- [ ] **8. Performance** (7 issues)

---

## 1. React/Ink Best Practices

- [x] **1.1: Memory Leak - setTimeout without cleanup** ✓

  **File:** `src/cli/tui/App.tsx:131-148`

  **Fixed:** Uses `statusTimeoutRef` to store timeout, clears existing timeout before setting new one, and has unmount cleanup effect.

---

- [x] **1.2: Missing useCallback dependency causing cascade** ✓

  **File:** `src/cli/tui/hooks/useRequests.ts:38,52-55,88`

  **Fixed:** Uses `requestsLengthRef` synced via separate effect, `fetchRequests` has empty dependency array.

---

- [x] **1.3: Stale closure in showStatus toggle message** ✓

  **File:** `src/cli/tui/App.tsx:264-266`

  **Fixed:** Now calculates new value first, then uses it for both setState and showStatus.

---

- [x] **1.4: Missing React.memo on list items** ✓

  **File:** `src/cli/tui/components/RequestListItem.tsx`

  **Fixed:** Wrapped component in `memo()`.

---

- [x] **1.5: useOnWheel handlers may capture stale values** ✓

  **File:** `src/cli/tui/App.tsx`

  **Fixed:** Added `contentHeightRef` and `requestsLengthRef`, synced on every render. Wheel callback reads from refs instead of closure values.

---

## 2. TypeScript Quality

**Positive Observations:**
- Zero `any` usage in the entire codebase ✓
- Strict mode enabled with `noUncheckedIndexedAccess` ✓
- `import type` used correctly throughout ✓
- Good discriminated union patterns ✓

---

- [x] **2.1: JSON.parse without runtime validation** ✓

  **File:** `src/daemon/control.ts`

  **Fixed:** Added `isControlMessage()` type guard. Parsed JSON is validated before use; invalid messages throw with a descriptive error.

---

- [x] **2.2: Unsafe parameter casting in control handlers** ✓

  **File:** `src/daemon/control.ts`

  **Fixed:** Added `optionalString()`, `optionalNumber()`, `requireString()` validation helpers. All handlers now use runtime type checks instead of `as` casts.

---

- [x] **2.3: Database query results cast without guards** ✓

  **File:** `src/daemon/storage.ts`

  **Fixed:** Added `DbSessionRow` and `DbCountRow` interfaces. Replaced all inline type assertions with named interfaces for consistency. Risk accepted for internal DB (schema is controlled by the application).

---

- [x] **2.4: RequestHandler type too loose** ✓

  **File:** `src/daemon/control.ts`

  **Fixed:** Replaced `Record<string, RequestHandler>` with typed `ControlHandlers` interface that enumerates all valid methods. `handleMessage` uses `in` guard before indexing. Params remain `Record<string, unknown>` (wire format) but are validated at runtime by the helpers from 2.2.

---

## 3. Code Completeness

- [x] **3.1: getStatusText incomplete AND duplicated** ✓

  **Fixed:** Extracted to `src/cli/tui/utils/formatters.ts` with comprehensive HTTP status code coverage (1xx through 5xx). Removed duplicate implementations from `har.ts` and `AccordionPanel.tsx`.

---

- [x] **3.2: Hardcoded version in HAR export** ✓

  **File:** `src/cli/tui/utils/har.ts:192-196`

  **Fixed:** Now imports and uses `getHtpxVersion()`.

---

- [x] **3.3: Missing try-catch around URL parsing** ✓

  **File:** `src/cli/tui/hooks/useSaveBinary.ts:28`

  **Fixed:** Wrapped in try-catch, falls through to content-type detection on invalid URL.

---

- [x] **3.4: Dead code - unused components** ✓

  **Fixed:** Deleted `BodyView.tsx` and `HeadersView.tsx`. `Modal.tsx` did not exist.

---

- [ ] **3.5: Magic numbers throughout**

  - `1000` - request limit (useRequests.ts:60, storage.ts:276)
  - `5000` - control timeout (control.ts:315)
  - `200` - log lines (debug-dump.ts:91)

  **Fix:** Extract to named constants.

---

- [x] **3.6: Silent error swallowing in migrations** ✓

  **File:** `src/daemon/storage.ts:65-72`

  **Fixed:** Replaced with version-tracked migration system using SQLite's `PRAGMA user_version`. Migrations are versioned objects, run in a transaction (rollback on failure), and real errors propagate. New databases are stamped to latest version to skip already-baked-in migrations.

---

- [x] **3.7: Missing JSON.parse error handling in storage** ✓

  **File:** `src/daemon/storage.ts`

  **Fixed:** Added `safeParseHeaders()` method with try-catch, returns empty object on parse failure. Used for both request and response header parsing in `rowToRequest()`.

---

## 4. Test Coverage

- [x] **4.0: No TUI component tests at all (CRITICAL)** ✓

  **Fixed:** Added comprehensive tests:
  - `tests/unit/tui/app-keyboard.test.tsx` - 26 tests covering navigation, panel switching, section toggle, URL toggle, actions
  - `tests/unit/tui/save-modal.test.tsx` - 21 tests covering rendering, navigation, option selection, custom path input
  - `tests/unit/tui/accordion-panel.test.tsx` - 21 tests covering rendering, expansion, focus indicator, body content display

---

- [ ] **4.1: Missing unit tests for utilities**

  - `src/cli/tui/utils/clipboard.ts` - no tests
  - `src/cli/tui/hooks/useRequests.ts` - no tests
  - `src/daemon/control.ts` - `reviveBuffers()` not tested
  - `src/daemon/proxy.ts` - `flattenHeaders()` not tested

  **Fix:** Add unit tests for each.

---

- [ ] **4.2: Missing integration tests**

  - POST/PUT requests with bodies
  - HTTPS request interception
  - Daemon lifecycle edge cases (stale PID, concurrent starts, crash recovery)
  - Control API error handling

  **Fix:** Add integration tests in `tests/integration/`.

---

- [ ] **4.3: Edge cases not tested**

  **Formatters:** `formatRelativeTime()` with negative/zero timestamps, `formatSize()` with very large numbers

  **HAR:** Binary body handling, truncated body flag

  **Curl:** Binary request body, newlines in body

  **Fix:** Add edge case tests to existing test files.

---

- [x] **4.4: Coverage theatre - types.test.ts** ✓

  **Fixed:** Deleted `tests/unit/types.test.ts`.

---

## 5. Project Organisation

- [ ] **5.1: ControlClient in wrong module**

  **File:** `src/daemon/control.ts:266-380`

  **Issue:** `ControlClient` is used by CLI/TUI but lives in `daemon/`. Should be in `shared/control-client.ts`.

  **Fix:** Move to `shared/control-client.ts`, update imports.

---

- [ ] **5.2: shared/daemon.ts imports from daemon/**

  **File:** `src/shared/daemon.ts:6`

  ```typescript
  import { ControlClient } from "../daemon/control.js";
  ```

  **Issue:** "Shared" module depends on "daemon" module - confusing dependency direction.

  **Fix:** Will be resolved by 5.1.

---

- [ ] **5.3: AccordionPanel.tsx doing too much (451 lines)**

  **File:** `src/cli/tui/components/AccordionPanel.tsx`

  Contains: section height calculation, HTTP status text mapping, content type formatting, binary content detection, headers display, body display, truncation handling.

  **Fix:** Extract helpers to utils, extract sub-components.

---

- [ ] **5.4: Repeated patterns across CLI commands**

  Project root finding and error message formatting patterns repeated in: `clear.ts`, `debug-dump.ts`, `restart.ts`, `status.ts`, `stop.ts`

  **Fix:** Create `requireProjectRoot()` and `getErrorMessage()` helpers.

---

**Positive Observations:**
- No circular dependencies (verified with madge) ✓
- Clear three-layer architecture (CLI -> Daemon) ✓
- Good test organisation ✓

---

## 6. Security

**Positive Observations:**
- Parameterised SQL queries throughout ✓
- CA key and socket permissions properly restricted (0o600) ✓
- Proxy bound to localhost only ✓
- Clipboard uses stdin, not command args (no injection) ✓

---

- [ ] **6.1: Sensitive headers stored unredacted**

  **File:** `src/daemon/storage.ts:14-37, 173-212`

  **Issue:** All HTTP headers stored in plain text including `Authorization`, `Cookie`, API keys.

  **Fix:** Add option to redact sensitive headers in display/export (future feature).

---

- [ ] **6.2: Shell escaping could be more robust**

  **File:** `src/cli/tui/utils/curl.ts:23-25`

  ```typescript
  function shellEscape(str: string): string {
    return str.replace(/'/g, "'\"'\"'");
  }
  ```

  **Issue:** Only escapes single quotes.

  **Fix:** Use more comprehensive escaping or a library.

---

- [ ] **6.3: --label not sanitised**

  **File:** `src/cli/commands/intercept.ts:79-81`

  **Issue:** User-provided label could contain shell metacharacters when eval'd.

  **Fix:** Sanitise or validate label input.

---

- [ ] **6.4: Unbounded buffer growth (DoS risk)**

  **File:** `src/daemon/control.ts:133-162`

  ```typescript
  let buffer = "";
  socket.on("data", (data) => {
    buffer += data.toString();
    // Only processes when newline found
  });
  ```

  **Issue:** Malformed client sending data without newlines grows buffer indefinitely.

  **Fix:** Add maximum buffer size check (e.g., 10MB), disconnect clients that exceed.

---

## 7. UX/UI Principles

- [ ] **7.1: No help key**

  **Issue:** No `?` or `F1` key showing all available shortcuts.

  **Fix:** Add help overlay triggered by `?`.

---

- [ ] **7.2: No Home/End/PageUp/PageDown navigation**

  **Issue:** Users with many requests must press j/k repeatedly.

  **Fix:** Add `Home`/`End` (or `g`/`G`), `Page Up`/`Page Down` (or `Ctrl+u`/`Ctrl+d`).

---

- [ ] **7.3: Loading state has no spinner**

  **File:** `src/cli/tui/App.tsx:304-313`

  **Issue:** Shows "Loading..." with no animation.

  **Fix:** Add animated spinner component.

---

- [ ] **7.4: No minimum terminal size check**

  **Issue:** Very small terminals result in broken layouts.

  **Fix:** Check terminal size on startup, show friendly message if too small.

---

- [ ] **7.5: Focus indicator hard to spot**

  **File:** `src/cli/tui/components/AccordionSection.tsx:52-54`

  **Issue:** Small bullet character "●" difficult to see.

  **Fix:** Use more prominent indicator (inverse colours, `>>` prefix).

---

- [ ] **7.6: Empty states don't guide users**

  **Issue:** "No requests captured yet" provides no guidance on what to do next.

  **Fix:** Add "Configure HTTP_PROXY to start capturing. See 'htpx help'."

---

- [ ] **7.7: Colour-only status differentiation**

  **File:** `src/cli/tui/components/RequestListItem.tsx:21-36`

  **Issue:** Status codes rely solely on colour - accessibility issue for colour blindness.

  **Fix:** Add text indicators (checkmark for 2xx, X for 4xx/5xx).

---

- [ ] **7.8: Red used for both errors AND DELETE method**

  **Issue:** Semantic confusion - successful DELETE (200) shows green status but red method.

  **Fix:** Use different colour for DELETE (magenta or orange).

---

**Positive Observations:**
- SaveModal UX is well done ✓
- Selection indicators are consistent ✓
- Status bar provides quick reference ✓

---

## 8. Performance

- [x] **8.1: SELECT * fetches bodies in listRequests** ✓

  **File:** `src/daemon/storage.ts:279-284`

  **Fixed:** Added `listRequestsSummary()` method that excludes body and header data. Returns only metadata and body sizes.

---

- [x] **8.2: IPC transfers full bodies through JSON** ✓

  **File:** `src/daemon/control.ts:89-95, 148`

  **Fixed:** Resolved by 8.1 - TUI now uses `listRequestsSummary` for polling, fetches full data on demand.

---

- [x] **8.3: Full dataset transfer on each poll** ✓

  **File:** `src/cli/tui/hooks/useRequests.ts:54-64`

  **Fixed:** Resolved by 8.1 - polling now transfers summaries only (~100 bytes per request vs ~10KB+).

---

- [ ] **8.4: requestInfo Map never cleaned for failed requests**

  **File:** `src/daemon/proxy.ts:51, 109, 117`

  **Issue:** Entry is set in `beforeRequest`, only deleted in `beforeResponse`. Failed/dropped connections leave orphaned entries.

  **Fix:** Add periodic cleanup (every 60s) removing entries older than 5 minutes.

---

- [ ] **8.5: Synchronous logging blocks event loop**

  **File:** `src/shared/logger.ts:70-72, 105-117`

  **Issue:** Every log entry performs `fs.appendFileSync()`.

  **Fix:** Buffer and flush periodically, or use async/stream.

---

- [ ] **8.6: New socket per control request**

  **File:** `src/daemon/control.ts:278-319`

  **Issue:** Each request creates new socket connection. TUI polls every 2 seconds.

  **Fix:** Implement connection pooling or persistent connection (lower priority).

---

- [ ] **8.7: Per-item mouse handlers**

  **File:** `src/cli/tui/components/RequestListItem.tsx:65-75`

  **Issue:** Each item creates 3 mouse event handlers. With 50+ visible items = 150+ listeners.

  **Fix:** Move mouse tracking to parent, use event delegation.

---

**Key Insight:** Implementing `listRequestsSummary()` would fix issues 8.1, 8.2, and 8.3 simultaneously - the single most impactful performance improvement.

---

## Quick Wins (can fix in minutes)

- [x] 1.3 - Stale closure in toggle message ✓
- [x] 1.4 - Add React.memo to RequestListItem ✓
- [x] 3.2 - Use getHtpxVersion() in HAR export ✓
- [x] 3.3 - Add try-catch around URL parsing ✓
- [x] 3.4 - Delete dead code files ✓
- [x] 4.4 - Delete types.test.ts ✓

## High Impact (should prioritise)

- [x] 8.1 - listRequestsSummary() (fixes 8.1, 8.2, 8.3) ✓
- [x] 4.0 - TUI component tests ✓
- [x] 1.1 - setTimeout memory leak fix ✓ (already fixed)
- [x] 1.2 - useRequests callback stability ✓ (already fixed)
- [x] 3.1 - Extract & complete getStatusText() ✓
- [x] 3.6 - Proper migration system ✓
