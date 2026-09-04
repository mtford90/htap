/**
 * Shape of the TUI store. Everything the views render and every value the
 * keyboard and mouse handlers need is here, so no handler has to close over
 * React state.
 */

import type {
  BodySearchOptions,
  CapturedRequest,
  CapturedRequestSummary,
  InterceptorEvent,
  RequestFilter,
} from "../../shared/types.js";

/** The two focusable panels of the main view. */
export type Panel = "list" | "detail";

/** Detail-pane section indices, also the 2-5 keyboard shortcuts. */
export const SECTION_REQUEST = 0;
export const SECTION_REQUEST_BODY = 1;
export const SECTION_RESPONSE = 2;
export const SECTION_RESPONSE_BODY = 3;
export const SECTION_COUNT = 4;

export type BodyType = "request" | "response";

/** Exactly one modal can be open, which the discriminated union enforces. */
export type Modal =
  | { kind: "help" }
  | { kind: "interceptorLog" }
  | { kind: "formatExport" }
  | { kind: "bodyExport"; bodyType: BodyType }
  | { kind: "json"; data: unknown; title: string; contentType: string; bodySize: number }
  | { kind: "text"; text: string; title: string; contentType: string; bodySize: number };

/**
 * Which set of keybindings applies. The command table is keyed by this, so the
 * status-bar hints and the dispatcher cannot disagree about the current mode.
 * A modal that is taking text has its own mode, in which only Escape is bound
 * and every other key reaches the focused input.
 */
export type Mode =
  "browse" | "filter" | Modal["kind"] | "logFilter" | "exportPath" | "jsonFilter" | "textSearch";

/** A destructive action awaiting a 'y' keypress. */
export type Confirm = { kind: "clear" } | { kind: "replay"; requestId: string };

export interface InterceptorEventCounts {
  info: number;
  warn: number;
  error: number;
}

/** Filter applied to the interceptor event log. */
export interface EventFilter {
  /** Undefined means every level. */
  level?: "error" | "warn";
  /** Undefined means every interceptor. */
  interceptor?: string;
  search?: string;
}

export interface ConnectionSlice {
  proxyPort?: number;
  caCertPath: string;
  /** Epoch ms the TUI started, for the uptime readout. */
  startTime: number;
}

export interface RequestsSlice {
  /** Summaries ordered newest first. */
  items: CapturedRequestSummary[];
  loading: boolean;
  error: string | null;
  filter: RequestFilter;
  bodySearch?: BodySearchOptions;
}

export interface SelectionSlice {
  selectedId: string | null;
  following: boolean;
  pendingNew: number;
  activePanel: Panel;
  focusedSection: number;
  expandedSections: ReadonlySet<number>;
}

export interface DetailSlice {
  /** The full request currently shown in the detail pane. */
  request: CapturedRequest | null;
  /** ID the detail pane is showing, which lags `selection.selectedId` while fetching. */
  requestId: string | null;
}

export interface InterceptorsSlice {
  events: InterceptorEvent[];
  counts: InterceptorEventCounts;
  count: number;
}

/** The filter the bar opened with, so Escape can put it back. */
export interface FilterDraftOrigin {
  filter: RequestFilter;
  bodySearch?: BodySearchOptions;
}

export interface UiSlice {
  modal: Modal | null;
  confirm: Confirm | null;
  statusMessage?: string;
  showFullUrl: boolean;
  listWidthRatio: number;
  filterOpen: boolean;
  filterDraftOrigin: FilterDraftOrigin | null;
  hoveredPanel: Panel | null;
}

/** Cursor and search state of the text pager, reset every time it opens. */
export interface TextViewSlice {
  searchOpen: boolean;
  searchText: string;
  matchIndex: number;
}

/** Cursor, expansion and filter state of the JSON explorer. */
export interface JsonViewSlice {
  cursorIndex: number;
  expandedPaths: ReadonlySet<string>;
  matchingPaths: ReadonlySet<string>;
  filterOpen: boolean;
  filterText: string;
  /** Expansion to restore when the filter is cancelled. */
  preFilterExpansion: ReadonlySet<string> | null;
}

/** Filter state of the interceptor log. */
export interface LogViewSlice {
  filter: EventFilter;
  filterOpen: boolean;
  filterDraftOrigin: EventFilter;
}

/** Cursor and custom-path state shared by the two export pickers. */
export interface ExportViewSlice {
  optionIndex: number;
  /** The format picker moves on to a destination picker for HAR. */
  phase: "format" | "destination";
  customPathOpen: boolean;
  customPath: string;
}

/** Per-modal view state, so the command table can drive every modal key. */
export interface ModalsSlice {
  text: TextViewSlice;
  json: JsonViewSlice;
  log: LogViewSlice;
  export: ExportViewSlice;
}

/** Terminal-derived sizes the command handlers need for page-sized moves. */
export interface ViewportSlice {
  columns: number;
  rows: number;
  /** Rows the main content row occupies, borders included. */
  contentHeight: number;
  /** Rows the list panel can show, excluding its border. */
  listHeight: number;
}

/**
 * The imperative handle a scrolling view registers, so a command can move it
 * without the view mirroring the position into React state.
 */
export interface Scroller {
  scrollBy: (delta: number) => void;
  scrollTo: (offset: number) => void;
  /** Scrolls the least distance that brings the child fully into view. */
  scrollIntoView: (childId: string) => void;
  readonly scrollTop: number;
  readonly viewportRows: number;
  readonly maxScrollTop: number;
}

export type ScrollerName = "list" | "text" | "json" | "log";

export interface TuiState {
  connection: ConnectionSlice;
  requests: RequestsSlice;
  selection: SelectionSlice;
  detail: DetailSlice;
  interceptors: InterceptorsSlice;
  ui: UiSlice;
  modals: ModalsSlice;
  viewport: ViewportSlice;
  /** Imperative, never rendered from: subscribing to it would be a mistake. */
  scrollers: Partial<Record<ScrollerName, Scroller>>;
}

export const ALL_SECTIONS: ReadonlySet<number> = new Set([
  SECTION_REQUEST,
  SECTION_REQUEST_BODY,
  SECTION_RESPONSE,
  SECTION_RESPONSE_BODY,
]);

export const EMPTY_COUNTS: InterceptorEventCounts = { info: 0, warn: 0, error: 0 };

export const EMPTY_PATHS: ReadonlySet<string> = new Set<string>();

export const INITIAL_TEXT_VIEW: TextViewSlice = {
  searchOpen: false,
  searchText: "",
  matchIndex: 0,
};

export const INITIAL_JSON_VIEW: JsonViewSlice = {
  cursorIndex: 0,
  expandedPaths: EMPTY_PATHS,
  matchingPaths: EMPTY_PATHS,
  filterOpen: false,
  filterText: "",
  preFilterExpansion: null,
};

export const INITIAL_LOG_VIEW: LogViewSlice = {
  filter: {},
  filterOpen: false,
  filterDraftOrigin: {},
};

export const INITIAL_EXPORT_VIEW: ExportViewSlice = {
  optionIndex: 0,
  phase: "format",
  customPathOpen: false,
  customPath: "",
};
