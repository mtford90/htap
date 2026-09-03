/**
 * The TUI store and every pure transition over it.
 *
 * Handlers read `store.getState()` synchronously, so no keyboard, mouse or sync
 * callback needs to mirror state into a ref to see the current value.
 */

import { createStore, type StoreApi } from "zustand/vanilla";
import type {
  BodySearchOptions,
  CapturedRequest,
  CapturedRequestSummary,
  InterceptorEvent,
  RequestFilter,
} from "../../shared/types.js";
import {
  countPrependedRequests,
  resolveEffectiveListScrollOffset,
  resolveSelectedIndex,
} from "./list-geometry.js";
import {
  ALL_SECTIONS,
  EMPTY_COUNTS,
  SECTION_COUNT,
  SECTION_REQUEST,
  type Confirm,
  type InterceptorEventCounts,
  type Modal,
  type Panel,
  type TuiState,
} from "./types.js";

export type TuiStore = StoreApi<TuiState>;

export const DEFAULT_LIST_RATIO = 0.6;
export const MIN_LIST_RATIO = 0.15;
export const MAX_LIST_RATIO = 0.85;
export const RATIO_STEP = 0.05;

const DEFAULT_COLUMNS = 80;
const DEFAULT_ROWS = 24;

export interface CreateStoreOptions {
  caCertPath?: string;
  proxyPort?: number;
  startTime?: number;
}

export const createTuiStore = (options: CreateStoreOptions = {}): TuiStore =>
  createStore<TuiState>(() => ({
    connection: {
      proxyPort: options.proxyPort,
      caCertPath: options.caCertPath ?? "",
      startTime: options.startTime ?? Date.now(),
    },
    requests: { items: [], loading: true, error: null, filter: {} },
    selection: {
      selectedId: null,
      topVisibleId: null,
      following: true,
      pendingNew: 0,
      activePanel: "list",
      focusedSection: SECTION_REQUEST,
      expandedSections: ALL_SECTIONS,
    },
    detail: { request: null, requestId: null },
    interceptors: { events: [], counts: EMPTY_COUNTS, count: 0 },
    ui: {
      modal: null,
      confirm: null,
      showFullUrl: false,
      listWidthRatio: DEFAULT_LIST_RATIO,
      filterOpen: false,
    },
    viewport: { columns: DEFAULT_COLUMNS, rows: DEFAULT_ROWS, contentHeight: 1, listHeight: 1 },
  }));

// --- derived values ---------------------------------------------------------

export const selectedIndex = (state: TuiState): number =>
  resolveSelectedIndex({
    requests: state.requests.items,
    selectedRequestId: state.selection.selectedId,
    following: state.selection.following,
  });

export const listScrollOffset = (state: TuiState): number => {
  const items = state.requests.items;
  const maxListOffset = Math.max(0, items.length - state.viewport.listHeight);
  return resolveEffectiveListScrollOffset({
    requests: items,
    following: state.selection.following,
    topVisibleRequestId: state.selection.topVisibleId,
    selectedIndex: selectedIndex(state),
    maxListOffset,
  });
};

export const selectedSummary = (state: TuiState): CapturedRequestSummary | undefined => {
  const index = selectedIndex(state);
  return index >= 0 ? state.requests.items[index] : undefined;
};

/** True when a modal or the filter bar owns the keyboard. */
export const isMainViewActive = (state: TuiState): boolean =>
  state.ui.modal === null && !state.ui.filterOpen;

// --- transitions ------------------------------------------------------------

const anchorTopToCurrentOffset = (state: TuiState): string | null => {
  const items = state.requests.items;
  return items[listScrollOffset(state)]?.id ?? items[0]?.id ?? null;
};

/**
 * Leaving follow mode pins the viewport where it currently sits, so the rows
 * under the cursor do not jump when the next request arrives.
 */
const enterBrowse = (state: TuiState): Partial<TuiState["selection"]> =>
  state.selection.following
    ? { following: false, topVisibleId: anchorTopToCurrentOffset(state) }
    : {};

const patchSelection = (store: TuiStore, patch: Partial<TuiState["selection"]>): void => {
  store.setState((state) => ({ selection: { ...state.selection, ...patch } }));
};

/** True for modals that render the currently selected request. */
const needsRequest = (modal: Modal | null): boolean =>
  modal?.kind === "bodyExport" || modal?.kind === "formatExport";

const patchUi = (store: TuiStore, patch: Partial<TuiState["ui"]>): void => {
  store.setState((state) => ({ ui: { ...state.ui, ...patch } }));
};

export const createTuiActions = (store: TuiStore) => {
  const moveSelectionBy = (delta: number): void => {
    const state = store.getState();
    const items = state.requests.items;
    if (items.length === 0) {
      return;
    }
    const current = Math.max(0, selectedIndex(state));
    const next = Math.min(Math.max(current + delta, 0), items.length - 1);
    patchSelection(store, { ...enterBrowse(state), selectedId: items[next]?.id ?? null });
  };

  return {
    // --- list navigation ---
    moveSelectionBy,

    selectId: (id: string): void => {
      const state = store.getState();
      patchSelection(store, {
        ...enterBrowse(state),
        selectedId: id,
        activePanel: "list" as Panel,
      });
    },

    selectIndex: (index: number): void => {
      const state = store.getState();
      const target = state.requests.items[index];
      if (target) {
        patchSelection(store, {
          ...enterBrowse(state),
          selectedId: target.id,
          activePanel: "list" as Panel,
        });
      }
    },

    jumpToLast: (): void => {
      const state = store.getState();
      const items = state.requests.items;
      const lastIndex = Math.max(0, items.length - 1);
      const topIndex = Math.max(0, lastIndex - state.viewport.listHeight + 1);
      patchSelection(store, {
        following: false,
        topVisibleId: items[topIndex]?.id ?? items[0]?.id ?? null,
        selectedId: items[lastIndex]?.id ?? null,
      });
    },

    resetToFollow: (): void => {
      patchSelection(store, {
        following: true,
        selectedId: null,
        topVisibleId: null,
        pendingNew: 0,
      });
    },

    toggleFollow: (): void => {
      const state = store.getState();
      if (state.selection.following) {
        const items = state.requests.items;
        patchSelection(store, {
          following: false,
          selectedId: items[Math.max(0, selectedIndex(state))]?.id ?? items[0]?.id ?? null,
          topVisibleId: anchorTopToCurrentOffset(state),
        });
        return;
      }
      patchSelection(store, {
        following: true,
        selectedId: null,
        topVisibleId: null,
        pendingNew: 0,
      });
    },

    /** Wheel scrolling moves the viewport without moving the cursor. */
    scrollListBy: (delta: number): void => {
      const state = store.getState();
      const items = state.requests.items;
      const maxOffset = Math.max(0, items.length - state.viewport.listHeight);
      const nextOffset = Math.min(Math.max(listScrollOffset(state) + delta, 0), maxOffset);
      patchSelection(store, {
        ...enterBrowse(state),
        topVisibleId: items[nextOffset]?.id ?? null,
      });
    },

    // --- panels and sections ---
    setActivePanel: (panel: Panel): void => patchSelection(store, { activePanel: panel }),

    focusSection: (section: number): void =>
      patchSelection(store, { activePanel: "detail", focusedSection: section }),

    moveSectionBy: (delta: number): void => {
      const { focusedSection } = store.getState().selection;
      const next = Math.min(Math.max(focusedSection + delta, 0), SECTION_COUNT - 1);
      patchSelection(store, { focusedSection: next });
    },

    toggleSection: (section: number): void => {
      const expanded = new Set<number>(store.getState().selection.expandedSections);
      if (expanded.has(section)) {
        expanded.delete(section);
      } else {
        expanded.add(section);
      }
      patchSelection(store, { expandedSections: expanded });
    },

    /** Tab and Shift+Tab walk list → each detail section → back to the list. */
    cycleFocus: (backwards: boolean): void => {
      const state = store.getState();
      if (state.detail.request === null) {
        return;
      }
      const { activePanel, focusedSection } = state.selection;
      if (backwards) {
        if (activePanel === "detail") {
          if (focusedSection > SECTION_REQUEST) {
            patchSelection(store, { focusedSection: focusedSection - 1 });
          } else {
            patchSelection(store, { activePanel: "list" });
          }
        } else {
          patchSelection(store, {
            activePanel: "detail",
            focusedSection: SECTION_COUNT - 1,
          });
        }
        return;
      }

      if (activePanel === "list") {
        patchSelection(store, { activePanel: "detail", focusedSection: SECTION_REQUEST });
      } else if (focusedSection < SECTION_COUNT - 1) {
        patchSelection(store, { focusedSection: focusedSection + 1 });
      } else {
        patchSelection(store, { activePanel: "list" });
      }
    },

    // --- layout ---
    resizeListBy: (delta: number): void => {
      const ratio = store.getState().ui.listWidthRatio + delta;
      patchUi(store, {
        listWidthRatio: Math.min(Math.max(ratio, MIN_LIST_RATIO), MAX_LIST_RATIO),
      });
    },

    resetListWidth: (): void => patchUi(store, { listWidthRatio: DEFAULT_LIST_RATIO }),

    setViewport: (viewport: TuiState["viewport"]): void => store.setState({ viewport }),

    // --- ui ---
    toggleFullUrl: (): boolean => {
      const next = !store.getState().ui.showFullUrl;
      patchUi(store, { showFullUrl: next });
      return next;
    },

    setStatusMessage: (statusMessage: string | undefined): void =>
      patchUi(store, { statusMessage }),

    openModal: (modal: Modal): void => patchUi(store, { modal }),
    closeModal: (): void => patchUi(store, { modal: null }),
    setConfirm: (confirm: Confirm | null): void => patchUi(store, { confirm }),
    setFilterOpen: (filterOpen: boolean): void => patchUi(store, { filterOpen }),

    // --- data, written by the sync engine ---
    setFilter: (filter: RequestFilter, bodySearch: BodySearchOptions | undefined): void => {
      store.setState((state) => ({ requests: { ...state.requests, filter, bodySearch } }));
    },

    setLoading: (loading: boolean): void => {
      store.setState((state) => ({ requests: { ...state.requests, loading } }));
    },

    setError: (error: string | null): void => {
      store.setState((state) => ({ requests: { ...state.requests, error, loading: false } }));
    },

    /**
     * Replace the list. New rows arriving while browsing are counted as pending
     * and the selection is re-anchored by ID, so nothing has to be corrected
     * after the frame is drawn.
     */
    setRequests: (items: CapturedRequestSummary[]): void => {
      const state = store.getState();
      const previousIds = state.requests.items.map((item) => item.id);
      const { following, selectedId } = state.selection;

      const nextSelection: Partial<TuiState["selection"]> = {};
      if (following) {
        nextSelection.pendingNew = 0;
      } else {
        const prepended = countPrependedRequests(previousIds, items);
        if (prepended > 0) {
          nextSelection.pendingNew = state.selection.pendingNew + prepended;
        }
        if (items.length === 0) {
          nextSelection.selectedId = null;
        } else if (selectedId && !items.some((item) => item.id === selectedId)) {
          const fallback = Math.min(listScrollOffset(state), items.length - 1);
          nextSelection.selectedId = items[fallback]?.id ?? items[0]?.id ?? null;
        }
      }

      const hasSelectionChange = Object.keys(nextSelection).length > 0;
      store.setState((current) => ({
        requests: { ...current.requests, items, loading: false, error: null },
        selection: hasSelectionChange
          ? { ...current.selection, ...nextSelection }
          : current.selection,
      }));
    },

    setDetail: (requestId: string | null, request: CapturedRequest | null): void => {
      store.setState((state) => ({
        detail: { requestId, request },
        // A request-backed modal has nothing left to render once the request is
        // gone, and it would swallow every key while showing a blank screen.
        ui:
          request === null && needsRequest(state.ui.modal)
            ? { ...state.ui, modal: null }
            : state.ui,
        // A newly selected request opens with every section expanded.
        selection:
          requestId !== state.detail.requestId
            ? { ...state.selection, expandedSections: ALL_SECTIONS }
            : state.selection,
      }));
    },

    setInterceptorEvents: (
      events: InterceptorEvent[],
      counts: InterceptorEventCounts,
      count: number
    ): void => {
      const current = store.getState().interceptors;
      if (
        current.events === events &&
        current.count === count &&
        current.counts.info === counts.info &&
        current.counts.warn === counts.warn &&
        current.counts.error === counts.error
      ) {
        return;
      }
      store.setState({ interceptors: { events, counts, count } });
    },

    setConnection: (proxyPort: number | undefined, caCertPath: string): void => {
      store.setState((state) => ({ connection: { ...state.connection, proxyPort, caCertPath } }));
    },
  };
};

export type TuiActions = ReturnType<typeof createTuiActions>;
