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
import { defaultExpansion } from "../utils/json-tree.js";
import { countPrependedRequests, resolveSelectedIndex } from "./list-geometry.js";
import {
  ALL_SECTIONS,
  EMPTY_COUNTS,
  INITIAL_EXPORT_VIEW,
  INITIAL_JSON_VIEW,
  INITIAL_LOG_VIEW,
  INITIAL_TEXT_VIEW,
  SECTION_COUNT,
  SECTION_REQUEST,
  type Confirm,
  type EventFilter,
  type ExportViewSlice,
  type InterceptorEventCounts,
  type JsonViewSlice,
  type Modal,
  type Mode,
  type Panel,
  type Scroller,
  type ScrollerName,
  type TextViewSlice,
  type TuiState,
} from "./types.js";

export type TuiStore = StoreApi<TuiState>;

export const DEFAULT_LIST_RATIO = 0.6;
export const MIN_LIST_RATIO = 0.15;
export const MAX_LIST_RATIO = 0.85;
export const RATIO_STEP = 0.05;

const DEFAULT_COLUMNS = 80;
const DEFAULT_ROWS = 24;
export const STATUS_MESSAGE_TIMEOUT_MS = 3000;

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
      filterDraftOrigin: null,
      hoveredPanel: null,
    },
    modals: {
      text: INITIAL_TEXT_VIEW,
      json: INITIAL_JSON_VIEW,
      log: INITIAL_LOG_VIEW,
      export: INITIAL_EXPORT_VIEW,
    },
    viewport: { columns: DEFAULT_COLUMNS, rows: DEFAULT_ROWS, contentHeight: 1, listHeight: 1 },
    scrollers: {},
  }));

// --- derived values ---------------------------------------------------------

export const selectedIndex = (state: TuiState): number =>
  resolveSelectedIndex({
    requests: state.requests.items,
    selectedRequestId: state.selection.selectedId,
    following: state.selection.following,
  });

export const selectedSummary = (state: TuiState): CapturedRequestSummary | undefined => {
  const index = selectedIndex(state);
  return index >= 0 ? state.requests.items[index] : undefined;
};

/** Which keybindings apply: the filter bar and each modal own the keyboard. */
export const currentMode = (state: TuiState): Mode => {
  if (state.ui.filterOpen) {
    return "filter";
  }
  const modal = state.ui.modal;
  if (!modal) {
    return "browse";
  }
  if (modal.kind === "text") {
    return state.modals.text.searchOpen ? "textSearch" : "text";
  }
  if (modal.kind === "json") {
    return state.modals.json.filterOpen ? "jsonFilter" : "json";
  }
  if (modal.kind === "interceptorLog") {
    return state.modals.log.filterOpen ? "logFilter" : "interceptorLog";
  }
  const isExport = modal.kind === "bodyExport" || modal.kind === "formatExport";
  if (isExport && state.modals.export.customPathOpen) {
    return "exportPath";
  }
  return modal.kind;
};

// --- transitions ------------------------------------------------------------

/** The single transition for every move of the cursor; the view follows it. */
const selectRow = (state: TuiState, index: number): Partial<TuiState["selection"]> => ({
  following: false,
  selectedId: state.requests.items[index]?.id ?? null,
});

const patchSelection = (store: TuiStore, patch: Partial<TuiState["selection"]>): void => {
  store.setState((state) => ({ selection: { ...state.selection, ...patch } }));
};

/** True for modals that render the currently selected request. */
const needsRequest = (modal: Modal | null): boolean =>
  modal?.kind === "bodyExport" || modal?.kind === "formatExport";

const patchUi = (store: TuiStore, patch: Partial<TuiState["ui"]>): void => {
  store.setState((state) => ({ ui: { ...state.ui, ...patch } }));
};

const patchText = (store: TuiStore, patch: Partial<TextViewSlice>): void => {
  store.setState((state) => ({
    modals: { ...state.modals, text: { ...state.modals.text, ...patch } },
  }));
};

const patchJson = (store: TuiStore, patch: Partial<JsonViewSlice>): void => {
  store.setState((state) => ({
    modals: { ...state.modals, json: { ...state.modals.json, ...patch } },
  }));
};

const patchExport = (store: TuiStore, patch: Partial<ExportViewSlice>): void => {
  store.setState((state) => ({
    modals: { ...state.modals, export: { ...state.modals.export, ...patch } },
  }));
};

/** A modal always opens with the view state it had the first time. */
const initialModalView = (modal: Modal): Partial<TuiState["modals"]> => {
  if (modal.kind === "text") {
    return { text: INITIAL_TEXT_VIEW };
  }
  if (modal.kind === "json") {
    return { json: { ...INITIAL_JSON_VIEW, expandedPaths: defaultExpansion(modal.data) } };
  }
  if (modal.kind === "interceptorLog") {
    return { log: INITIAL_LOG_VIEW };
  }
  return { export: INITIAL_EXPORT_VIEW };
};

export const createTuiActions = (store: TuiStore) => {
  let statusTimeout: NodeJS.Timeout | null = null;

  const setStatusMessage = (statusMessage: string | undefined): void => {
    if (statusTimeout) {
      clearTimeout(statusTimeout);
      statusTimeout = null;
    }
    patchUi(store, { statusMessage });
  };

  const moveSelectionBy = (delta: number): void => {
    const state = store.getState();
    const items = state.requests.items;
    if (items.length === 0) {
      return;
    }
    const current = Math.max(0, selectedIndex(state));
    const next = Math.min(Math.max(current + delta, 0), items.length - 1);
    patchSelection(store, selectRow(state, next));
  };

  return {
    // --- list navigation ---
    moveSelectionBy,

    selectId: (id: string): void => {
      const state = store.getState();
      const index = state.requests.items.findIndex((item) => item.id === id);
      if (index === -1) {
        return;
      }
      patchSelection(store, { ...selectRow(state, index), activePanel: "list" as Panel });
    },

    selectIndex: (index: number): void => {
      const state = store.getState();
      if (!state.requests.items[index]) {
        return;
      }
      patchSelection(store, { ...selectRow(state, index), activePanel: "list" as Panel });
    },

    jumpToLast: (): void => {
      const state = store.getState();
      const items = state.requests.items;
      if (items.length === 0) {
        return;
      }
      patchSelection(store, selectRow(state, items.length - 1));
    },

    resetToFollow: (): void => {
      patchSelection(store, { following: true, selectedId: null, pendingNew: 0 });
    },

    toggleFollow: (): void => {
      const state = store.getState();
      if (state.selection.following) {
        const items = state.requests.items;
        patchSelection(store, {
          following: false,
          selectedId: items[Math.max(0, selectedIndex(state))]?.id ?? items[0]?.id ?? null,
        });
        return;
      }
      patchSelection(store, { following: true, selectedId: null, pendingNew: 0 });
    },

    /**
     * Wheel scrolling moves the viewport without moving the cursor. The
     * scrollbox has already moved itself by the time this runs; leaving the
     * cursor unpinned is what stops the viewport snapping back to it.
     */
    stopFollowing: (): void => {
      if (!store.getState().selection.following) {
        return;
      }
      patchSelection(store, { following: false });
    },

    // --- panels and sections ---
    setActivePanel: (panel: Panel): void => patchSelection(store, { activePanel: panel }),

    setHoveredPanel: (hoveredPanel: Panel | null): void => patchUi(store, { hoveredPanel }),

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

    /** A scrolling view lends the command table its scroll position. */
    registerScroller: (name: ScrollerName, scroller: Scroller | null): void => {
      store.setState((state) => ({
        scrollers: { ...state.scrollers, [name]: scroller ?? undefined },
      }));
    },

    // --- ui ---
    toggleFullUrl: (): boolean => {
      const next = !store.getState().ui.showFullUrl;
      patchUi(store, { showFullUrl: next });
      return next;
    },

    setStatusMessage,

    /** Shows a message and clears it again, so no view has to own the timer. */
    flashStatus: (message: string): void => {
      setStatusMessage(message);
      statusTimeout = setTimeout(() => {
        statusTimeout = null;
        patchUi(store, { statusMessage: undefined });
      }, STATUS_MESSAGE_TIMEOUT_MS);
    },

    /** Drops the pending status timer, so the process can exit promptly. */
    stopStatusTimer: (): void => {
      if (statusTimeout) {
        clearTimeout(statusTimeout);
        statusTimeout = null;
      }
    },

    openModal: (modal: Modal): void => {
      store.setState((state) => ({
        ui: { ...state.ui, modal },
        modals: { ...state.modals, ...initialModalView(modal) },
      }));
    },
    closeModal: (): void => patchUi(store, { modal: null }),
    setConfirm: (confirm: Confirm | null): void => patchUi(store, { confirm }),

    /** Opening the filter bar remembers what Escape should put back. */
    openFilter: (): void => {
      const { filter, bodySearch } = store.getState().requests;
      patchUi(store, { filterOpen: true, filterDraftOrigin: { filter, bodySearch } });
    },

    closeFilter: (): void => patchUi(store, { filterOpen: false, filterDraftOrigin: null }),

    // --- modal view state ---
    patchTextView: (patch: Partial<TextViewSlice>): void => patchText(store, patch),
    patchJsonView: (patch: Partial<JsonViewSlice>): void => patchJson(store, patch),
    patchExportView: (patch: Partial<ExportViewSlice>): void => patchExport(store, patch),

    setLogFilter: (filter: EventFilter): void => {
      store.setState((state) => ({
        modals: { ...state.modals, log: { ...state.modals.log, filter } },
      }));
    },

    openLogFilter: (): void => {
      store.setState((state) => ({
        modals: {
          ...state.modals,
          log: {
            ...state.modals.log,
            filterOpen: true,
            filterDraftOrigin: state.modals.log.filter,
          },
        },
      }));
    },

    closeLogFilter: (revert: boolean): void => {
      store.setState((state) => ({
        modals: {
          ...state.modals,
          log: {
            ...state.modals.log,
            filterOpen: false,
            filter: revert ? state.modals.log.filterDraftOrigin : state.modals.log.filter,
          },
        },
      }));
    },

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
          const fallback = Math.min(state.scrollers.list?.scrollTop ?? 0, items.length - 1);
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
