# Request List V2 Rebuild Plan (TUI)

**Date:** 2026-02-24  
**Status:** Draft for annotation  
**Primary goal:** Fix request-list jitter, flicker, and sluggish interaction under high traffic.

---

## 0) Intent & Scope

This effort is explicitly about **stabilising and speeding up the request list** in the TUI.

We will include adjacent architectural work **only when it materially supports request-list correctness/performance**, specifically:

1. Declarative keybinding registry (to reduce input handling contention/complexity)
2. Global state management via Zustand (selector-driven updates)
3. UI decomposition (list/detail/chrome split) with explicit caching strategy

### Non-goals (for this project)

- New list features unrelated to stability/perf
- Reworking interceptor log UI
- Broad TUI redesign outside request-list-related surfaces

---

## 1) Current Implementation Critique (why rebuild)

## A. Data update model causes jitter

- `useRequests` polls and replaces full list arrays (`setRequests(newRequests)`) instead of applying deltas.
- Poll requests can overlap (no single-flight guarantee), so stale responses can win.
- `countRequests + listRequestsSummary` introduces extra roundtrips and race surfaces.

**Impact:** visual jumpiness, wasted work, and responsiveness drops under load.

## B. Ordering stability is weak under burst traffic

- List ordering is timestamp-desc only.
- Same-millisecond events can shuffle between polls.

**Impact:** rows appear to move/flicker even when user is anchored.

## C. Selection anchoring is post-render and index-centric

- Re-anchoring to selected request ID happens in effects after list replacement.
- Selection/scroll interactions still rely on index transitions in hot paths.

**Impact:** brief wrong-frame renders ("glimpses") before snap-back.

## D. Async detail loading can paint stale data

- `getFullRequest(...).then(setSelectedFullRequest)` currently lacks stale-response guards.

**Impact:** rapid navigation under load can show old detail momentarily.

## E. App-level complexity amplifies rerender cost

- `App.tsx` is very large, with many states and a large key-handler branch chain.

**Impact:** harder to reason about hot path, harder to isolate updates, higher chance of cascading rerenders.

---

## 2) Design Principles for V2

1. **Deterministic order always** (monotonic order key, no ambiguous ties)
2. **ID-anchored list behavior** (selection + viewport by ID, not fragile index math)
3. **Single-flight sync** (drop stale results, never apply out-of-date payloads)
4. **Selector-driven rendering** (only components affected by changes rerender)
5. **Explicit mode semantics**
   - Follow mode: auto-track newest
   - Browse mode: viewport frozen, show pending new-count indicator
6. **Command-driven input layer** (declarative registry, context gates)
7. **Cache explicitly where it matters** (detail cache + stale guards)

---

## 3) Target Architecture (request-list-focused)

## A. Request List Store (Zustand)

A dedicated store slice for request-list concerns:

- `ids: string[]` (ordered list IDs)
- `byId: Map<string, CapturedRequestSummary>`
- `selectedId: string | null`
- `topVisibleId: string | null`
- `followMode: boolean`
- `pendingNewCount: number`
- `isSyncing: boolean`
- sync cursors (`lastSeq`, `syncGeneration`)

Actions:

- `applyDelta(...)`
- `replaceFromSnapshot(...)` (fallback/recovery)
- `selectNext/Prev/Page/...`
- `setFollowMode(...)`
- `setTopVisibleId(...)`
- `acknowledgePendingNew()`

## B. Input Command Registry

Declarative command map replacing large imperative if/else chain:

```ts
interface Command {
  id: string;
  keys: KeyChord[];
  when: (ctx: InputContext) => boolean;
  run: (ctx: InputContext, api: CommandApi) => void | Promise<void>;
  priority?: number;
}
```

Benefits tied to this project:

- fewer accidental interactions between list commands and modal states
- easier profiling/testing of list navigation commands
- deterministic precedence under heavy input

## C. Data Sync Engine (list)

- Single-flight polling loop (or scheduled tick that skips when in-flight)
- Generation token per request cycle; stale generations discarded
- Delta-first protocol (cursor/afterSeq), snapshot fallback

## D. UI decomposition

Split request-list path out of `App.tsx`:

- `TuiShell` (layout + modal routing)
- `RequestListPane` (windowed rendering + mouse/scroll)
- `RequestDetailPane` (selected request detail)
- `Status/Info bars` remain separate chrome layer

## E. Detail cache & stale guards

- LRU cache for full request payloads by ID
- in-flight request dedupe map
- apply-result guard: only set detail if request still selected

---

## 4) Updated 3-Milestone Delivery Plan

The original 5 phases are now intentionally compressed into **3 larger milestones**.

This better reflects how the work actually overlaps in practice while keeping clear checkpoints.

## Milestone 1 — Core stability (ordering, sync, and list behavior)

**Goal:** eliminate the primary flicker/jump causes as early as possible.

### Deliverables

- Add monotonic order column in storage (migration)
- Ensure list summary queries sort deterministically (`order_key DESC`, secondary tie-breaker)
- Add delta-capable list endpoint (`afterSeq`/cursor) or equivalent
- Update list sync hook to single-flight + stale-generation drop
- Move selection + viewport anchoring to ID-based transitions
- Implement explicit follow vs browse behavior in list state transitions
- Browse mode keeps viewport stable; new arrivals increment `pendingNewCount`
- "Jump to newest" action clears pending count and restores follow behavior

### File-level changes (expected)

- `src/daemon/storage.ts` (+ migration + query updates)
- `src/daemon/control.ts` (delta endpoint)
- `src/shared/control-client.ts` (client methods)
- `src/cli/tui/hooks/useRequestsV2.ts` (new)
- `src/cli/tui/state/request-list-store.ts` (new, initial behavior model)

### Exit criteria

- Stable row ordering under same-ms burst ingest
- No stale poll results applied after newer sync generation
- No visible list jump/reanchor artifacts during continuous ingress

---

## Milestone 2 — Architecture alignment (registry, Zustand, UI split, windowing)

**Goal:** make request-list performance predictable and maintainable.

### Deliverables

- Introduce declarative keybinding registry and route list commands through it
- Finalise request-list-focused Zustand slice with selector-driven subscriptions
- Split `App.tsx` into shell + request-list boundaries
- Extract `RequestListPane` and stabilise row props to minimise rerenders
- Introduce viewport + overscan windowing and paged history loading

### File-level changes (expected)

- `src/cli/tui/input/commands.ts` (new)
- `src/cli/tui/input/registry.ts` (new)
- `src/cli/tui/state/request-list-store.ts` (selector/action expansion)
- `src/cli/tui/App.tsx` (reduced)
- `src/cli/tui/components/RequestListPane.tsx` (new)
- `src/cli/tui/components/RequestList.tsx` (windowed renderer)
- `src/cli/tui/components/RequestListItem.tsx` (prop stability pass)

### Exit criteria

- No behaviour regressions in keyboard/mouse navigation
- List commands resolved via registry rather than a monolithic branch chain
- List-related rerenders are scoped to affected components/rows

---

## Milestone 3 — Consistency, validation, and rollout

**Goal:** harden correctness under stress and ship safely.

### Deliverables

- Full-request LRU cache for detail pane
- in-flight dedupe for `getFullRequest`
- stale-response apply guards (selection token/version)
- optional adjacent prefetch for perceived navigation speed
- Burst-load component tests for list stability and command responsiveness
- Integration test that simulates sustained ingest while user navigates
- Perf harness script and baseline comparison doc
- Feature flag (`requestListV2`) for staged rollout, then default-on and cleanup

### File-level changes (expected)

- `src/cli/tui/data/request-detail-cache.ts` (new)
- `src/cli/tui/hooks/useSelectedRequestDetail.ts` (new)
- `src/cli/tui/components/RequestDetailPane.tsx` (new)
- `src/cli/tui/App.test.tsx` (new burst scenarios)
- `tests/integration/*` (high-throughput TUI/daemon interaction)
- `docs/tui.md` updates (if behavior/hints change)

### Exit criteria

- Rapid navigation cannot display stale request details
- No flicker/jump artifacts in stress runs
- Acceptable input responsiveness under load
- V1 path removed after confidence window

---

## 5) Success Metrics (proposed)

> Thresholds are intentionally explicit so this plan is easy to annotate/change.

- **Visual stability:** no observable request row reordering jitter in browse mode under burst traffic
- **Selection correctness:** selected request ID remains stable unless user action changes it
- **Input responsiveness:** list navigation remains responsive during sustained ingest (target p95 key-to-frame latency: annotate)
- **No stale detail paint:** detail pane never shows request A while selection is B

---

## 6) Testing Strategy

## A. Component tests (Ink)

- Follow-mode burst prepend behavior
- Browse-mode viewport freeze with `pendingNewCount`
- Command registry precedence/gating (modal open vs list commands)
- Windowing correctness (selection visibility, overscan edges)

## B. Integration tests

- Daemon emits high-throughput traffic while TUI navigates
- Verify deterministic ordering and stable selection by ID
- Verify sync stale-generation dropping under delayed responses

## C. Regression guardrails

- Existing navigation/filter/export flows stay green
- Existing replay/bookmark interactions unaffected

---

## 7) Open Decisions for Annotation

1. **Delta API shape:** explicit `listRequestsDelta(afterSeq)` vs extending `listRequestsSummary` with cursor params
2. **Windowing strategy:** custom lightweight windowing vs adopting helper utility
3. **Detail cache size policy:** fixed N entries vs memory-budget-based
4. **Feature flag duration:** how long V1 and V2 should coexist
5. **Input latency target:** define numeric p95/p99 acceptance thresholds

---

## 8) Risks & Mitigations

- **Risk:** state duplication during migration (old local state + new store)
  - **Mitigation:** milestone-based migration by ownership (list first), remove old state immediately after cutover
- **Risk:** command registry changes behavior precedence unexpectedly
  - **Mitigation:** command precedence tests + explicit priority field
- **Risk:** DB migration complexity for order key
  - **Mitigation:** additive migration with fallback path and compatibility tests

---

## 9) Implementation Notes

- This document is intentionally request-list centric.
- Key registry + Zustand + UI split are included because they are enabling architecture for list stability/perf.
- React cache API is not the primary mechanism here; explicit domain caches and selector discipline are the main strategy.

---

## 10) Proposed execution order (concrete)

1. **Milestone 1 PR series** — core stability first (ordering + sync + ID-anchored behavior)
2. **Milestone 2 PR series** — architecture alignment (registry + Zustand + split + windowing)
3. **Milestone 3 PR series** — detail consistency + stress validation + rollout

This order should deliver user-visible stability improvements in Milestone 1, with maintainability and long-term performance confidence completed by Milestone 3.
