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

/** A destructive action awaiting a 'y' keypress. */
export type Confirm = { kind: "clear" } | { kind: "replay"; requestId: string };

export interface InterceptorEventCounts {
  info: number;
  warn: number;
  error: number;
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
  topVisibleId: string | null;
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

export interface UiSlice {
  modal: Modal | null;
  confirm: Confirm | null;
  statusMessage?: string;
  showFullUrl: boolean;
  listWidthRatio: number;
  filterOpen: boolean;
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

export interface TuiState {
  connection: ConnectionSlice;
  requests: RequestsSlice;
  selection: SelectionSlice;
  detail: DetailSlice;
  interceptors: InterceptorsSlice;
  ui: UiSlice;
  viewport: ViewportSlice;
}

export const ALL_SECTIONS: ReadonlySet<number> = new Set([
  SECTION_REQUEST,
  SECTION_REQUEST_BODY,
  SECTION_RESPONSE,
  SECTION_RESPONSE_BODY,
]);

export const EMPTY_COUNTS: InterceptorEventCounts = { info: 0, warn: 0, error: 0 };
