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

- [ ] **1.1: Memory Leak - setTimeout without cleanup**

  **File:** `src/cli/tui/App.tsx:116-119`

  ```tsx
  const showStatus = useCallback((message: string) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(undefined), 3000);
  }, []);
  ```

  **Issue:** The `setTimeout` is never cleaned up. If the component unmounts before the timeout fires, it will attempt to call `setStatusMessage` on an unmounted component. Additionally, if `showStatus` is called multiple times in quick succession, multiple timeouts will be active simultaneously.

  **Fix:** Store timeout in ref, clear on unmount and before setting new timeout.

---

- [ ] **1.2: Missing useCallback dependency causing cascade**

  **File:** `src/cli/tui/hooks/useRequests.ts:47-77`

  **Issue:** The `fetchRequests` callback depends on `requests.length`, causing it to be recreated whenever the requests array length changes. This triggers a cascade: `fetchRequests` changes → `refresh` changes → effects re-run → polling interval cleared/recreated.

  **Fix:** Use a ref to track `requests.length` instead of including it in dependencies.

---

- [ ] **1.3: Stale closure in showStatus toggle message**

  **File:** `src/cli/tui/App.tsx:264-266`

  ```tsx
  } else if (input === "u") {
    setShowFullUrl((prev) => !prev);
    showStatus(showFullUrl ? "Showing path" : "Showing full URL");
  }
  ```

  **Issue:** The message is based on the **current** value of `showFullUrl`, not the **next** value. The logic is inverted.

  **Fix:** Calculate new value first, then use it for both setState and showStatus.

---

- [ ] **1.4: Missing React.memo on list items**

  **File:** `src/cli/tui/components/RequestListItem.tsx`

  **Issue:** `RequestListItem` is rendered for every visible request and is not wrapped in `React.memo`. When any state changes in the parent, all list items re-render.

  **Fix:** Wrap component in `React.memo()`.

---

- [ ] **1.5: useOnWheel handlers may capture stale values**

  **File:** `src/cli/tui/App.tsx:85-94`

  **Issue:** The wheel callback captures `contentHeight` and `requests.length` from the closure. If `useOnWheel` stores the callback without updating it, scroll limits could be incorrect.

  **Fix:** Use refs to track current values.

---

## 2. TypeScript Quality

**Positive Observations:**
- Zero `any` usage in the entire codebase ✓
- Strict mode enabled with `noUncheckedIndexedAccess` ✓
- `import type` used correctly throughout ✓
- Good discriminated union patterns ✓

---

- [ ] **2.1: JSON.parse without runtime validation**

  **File:** `src/daemon/control.ts:145`

  ```typescript
  const message = JSON.parse(messageStr) as ControlMessage;
  ```

  **Issue:** Direct cast without validation. Malformed input could cause runtime errors.

  **Fix:** Add type guard function `isControlMessage()`.

---

- [ ] **2.2: Unsafe parameter casting in control handlers**

  **File:** `src/daemon/control.ts:74-112`

  ```typescript
  const label = params["label"] as string | undefined;
  const pid = params["pid"] as number | undefined;
  const id = params["id"] as string;
  ```

  **Issue:** These assertions trust incoming `params` without validation.

  **Fix:** Create `validateString()`, `validateNumber()`, `requireString()` helpers.

---

- [ ] **2.3: Database query results cast without guards**

  **File:** `src/daemon/storage.ts:129-131, 251, 288`

  **Issue:** `better-sqlite3` returns `unknown`, casts assume schema matches.

  **Fix:** Add minimal validation for critical queries, or accept the risk for internal DB.

---

- [ ] **2.4: RequestHandler type too loose**

  **File:** `src/daemon/control.ts:35`

  ```typescript
  type RequestHandler = (params: Record<string, unknown>) => unknown;
  ```

  **Issue:** Maximally loose - loses all type safety for the control API.

  **Fix:** Create discriminated union types for each endpoint.

---

## 3. Code Completeness

- [ ] **3.1: getStatusText incomplete AND duplicated**

  **Files:**
  - `src/cli/tui/utils/har.ts:104-123`
  - `src/cli/tui/components/AccordionPanel.tsx:432-450`

  **Issue:** Two separate implementations, both missing many status codes (100, 202, 206, 207, 303, 307, 308, 405, 406, 408, 409, 410, 413, 415, 422, 429, 501, 504, etc.)

  **Fix:** Extract to `utils/formatters.ts` with comprehensive coverage.

---

- [ ] **3.2: Hardcoded version in HAR export**

  **File:** `src/cli/tui/utils/har.ts:192-196`

  ```typescript
  creator: {
    name: "htpx",
    version: "1.0.0",  // Should use getHtpxVersion()
  },
  ```

  **Fix:** Import and use `getHtpxVersion()`.

---

- [ ] **3.3: Missing try-catch around URL parsing**

  **File:** `src/cli/tui/hooks/useSaveBinary.ts:28`

  ```typescript
  const urlPath = new URL(url).pathname;
  ```

  **Issue:** Will throw if URL is invalid.

  **Fix:** Wrap in try-catch, provide fallback.

---

- [ ] **3.4: Dead code - unused components**

  **Files:**
  - `src/cli/tui/components/BodyView.tsx` - unused
  - `src/cli/tui/components/HeadersView.tsx` - unused
  - `src/cli/tui/components/Modal.tsx` - incomplete refactoring?

  **Fix:** Delete if truly unused, or integrate if intended.

---

- [ ] **3.5: Magic numbers throughout**

  - `1000` - request limit (useRequests.ts:60, storage.ts:276)
  - `5000` - control timeout (control.ts:315)
  - `200` - log lines (debug-dump.ts:91)

  **Fix:** Extract to named constants.

---

- [ ] **3.6: Silent error swallowing in migrations**

  **File:** `src/daemon/storage.ts:65-72`

  ```typescript
  private applyMigrations(): void {
    for (const migration of MIGRATIONS) {
      try {
        this.db.exec(migration);
      } catch {
        // Column likely already exists, ignore
      }
    }
  }
  ```

  **Issue:** Silently ignores ALL errors, not just "column already exists". Could mask real migration failures.

  **Fix:** Implement proper migration tracking table, or at least check error message.

---

- [ ] **3.7: Missing JSON.parse error handling in storage**

  **File:** `src/daemon/storage.ts:345-346`

  ```typescript
  requestHeaders: row.request_headers
    ? (JSON.parse(row.request_headers) as Record<string, string>)
    : {},
  ```

  **Issue:** No try-catch - corrupted data could crash the application.

  **Fix:** Wrap in try-catch, return empty object on failure.

---

## 4. Test Coverage

- [ ] **4.0: No TUI component tests at all (CRITICAL)**

  **Issue:** There are **zero** ink-testing-library component tests for any TUI components.

  **Components needing tests:**
  1. `App.tsx` - keyboard navigation, panel switching, export actions
  2. `SaveModal.tsx` - option selection, custom path input
  3. `AccordionPanel.tsx` - section expansion, focus states
  4. `RequestList.tsx` - scroll behaviour, empty state
  5. `RequestListItem.tsx` - status colours, hover state

  **Fix:** Create `tests/unit/tui/*.test.tsx` files with ink-testing-library.

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

- [ ] **4.4: Coverage theatre - types.test.ts**

  **File:** `tests/unit/types.test.ts`

  **Issue:** Just creates objects matching TypeScript interfaces. Provides no runtime validation value.

  **Fix:** Delete or convert to actual validation tests.

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

- [ ] **8.1: SELECT * fetches bodies in listRequests**

  **File:** `src/daemon/storage.ts:279-284`

  **Issue:** Fetches `request_body` and `response_body` BLOBs even for list view. With 1000 requests averaging 10KB bodies, this transfers ~10MB per poll cycle.

  **Fix:** Add `listRequestsSummary()` excluding body columns.

---

- [ ] **8.2: IPC transfers full bodies through JSON**

  **File:** `src/daemon/control.ts:89-95, 148`

  **Issue:** Buffers become `{ type: 'Buffer', data: [...] }` which is ~4x larger than binary. A 1MB body becomes ~4MB of JSON.

  **Fix:** Will be resolved by 8.1 (don't transfer bodies in list).

---

- [ ] **8.3: Full dataset transfer on each poll**

  **File:** `src/cli/tui/hooks/useRequests.ts:54-64`

  **Issue:** When count changes, full dataset of up to 1000 requests (with bodies) is transferred.

  **Fix:** Will be resolved by 8.1, or implement incremental updates.

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

- [ ] 1.3 - Stale closure in toggle message
- [ ] 1.4 - Add React.memo to RequestListItem
- [ ] 3.2 - Use getHtpxVersion() in HAR export
- [ ] 3.3 - Add try-catch around URL parsing
- [ ] 3.4 - Delete dead code files
- [ ] 4.4 - Delete types.test.ts

## High Impact (should prioritise)

- [ ] 8.1 - listRequestsSummary() (fixes 8.1, 8.2, 8.3)
- [ ] 4.0 - TUI component tests
- [ ] 1.1 - setTimeout memory leak fix
- [ ] 1.2 - useRequests callback stability
- [ ] 3.1 - Extract & complete getStatusText()
- [ ] 3.6 - Proper migration system
