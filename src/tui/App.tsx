/** @jsxImportSource @opentui/react */

/**
 * Root of the OpenTUI TUI. It owns layout, the single keyboard entry point and
 * the effects that turn store changes into daemon calls; every piece of state
 * it renders comes from the store.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import {
  selectedIndex as selectSelectedIndex,
  selectedSummary,
  type TuiActions,
  type TuiStore,
} from "./store/store.js";
import type { TuiState } from "./store/types.js";
import type { SyncEngine } from "./sync/engine.js";
import { dispatchKey, visibleHints, type CommandDeps } from "./commands/table.js";
import { toKeyLike } from "./commands/keys.js";
import { copyToClipboard } from "./utils/clipboard.js";
import { isFilterActive } from "./utils/filters.js";
import { useSpinner } from "./hooks/useSpinner.js";
import { ListPane } from "./components/ListPane.js";
import { DetailPane } from "./components/DetailPane.js";
import { FilterBar } from "./components/FilterBar.js";
import { InfoBar } from "./components/InfoBar.js";
import { StatusBar } from "./components/StatusBar.js";
import { ModalHost } from "./components/ModalHost.js";
import { DIM } from "./components/styles.js";

export const MIN_TERMINAL_COLUMNS = 60;
export const MIN_TERMINAL_ROWS = 10;
const FILTER_BAR_ROWS = 2;
const INFO_BAR_ROWS = 1;
const STATUS_BAR_ROWS = 2;

export interface AppProps {
  store: TuiStore;
  actions: TuiActions;
  engine: SyncEngine;
  onExit: () => void;
}

const useTui = <T,>(store: TuiStore, selector: (state: TuiState) => T): T =>
  useStore(store, selector);

export function App({ store, actions, engine, onExit }: AppProps): React.ReactNode {
  const { width: columns, height: rows } = useTerminalDimensions();

  const requests = useTui(store, (state) => state.requests.items);
  const loading = useTui(store, (state) => state.requests.loading);
  const error = useTui(store, (state) => state.requests.error);
  const filter = useTui(store, (state) => state.requests.filter);
  const bodySearch = useTui(store, (state) => state.requests.bodySearch);
  const selection = useTui(store, (state) => state.selection);
  const detailRequest = useTui(store, (state) => state.detail.request);
  const ui = useTui(store, (state) => state.ui);
  const interceptors = useTui(store, (state) => state.interceptors);
  const connection = useTui(store, (state) => state.connection);
  const selectedIndex = useTui(store, selectSelectedIndex);
  // The hint list is rebuilt on every read, so compare it shallowly.
  const hints = useStore(store, useShallow(visibleHints));

  const spinnerFrame = useSpinner(loading && requests.length === 0);

  useEffect(() => actions.stopStatusTimer, [actions]);

  const filterBarRows = ui.filterOpen ? FILTER_BAR_ROWS : 0;
  const contentHeight = rows - STATUS_BAR_ROWS - INFO_BAR_ROWS - filterBarRows;
  const listHeight = Math.max(1, contentHeight - 2);

  // Layout effects land before the renderer draws, so the first frame already
  // has the real geometry rather than the store's placeholder.
  useLayoutEffect(() => {
    actions.setViewport({ columns, rows, contentHeight, listHeight });
  }, [actions, columns, rows, contentHeight, listHeight]);

  // The detail pane follows the cursor; the engine dedupes and caches the fetch.
  const selectedId = useTui(store, (state) => selectedSummary(state)?.id ?? null);
  useEffect(() => {
    engine.selectDetail(selectedId);
  }, [engine, selectedId]);

  const commandDeps: CommandDeps = useMemo(
    () => ({ store, actions, engine, exit: onExit, copyToClipboard }),
    [store, actions, engine, onExit]
  );

  // Global listeners run in registration order and this one mounts first, so
  // every key reaches the command table before any focused input sees it.
  useKeyboard((key) => {
    if (dispatchKey(commandDeps, toKeyLike(key))) {
      key.stopPropagation();
    }
  });

  const handleFilterChange = useCallback(
    (nextFilter: typeof filter, nextBodySearch: typeof bodySearch) => {
      engine.setFilter(nextFilter, nextBodySearch);
      actions.resetToFollow();
    },
    [engine, actions]
  );

  if (columns < MIN_TERMINAL_COLUMNS || rows < MIN_TERMINAL_ROWS) {
    return (
      <box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        width={columns}
        height={rows}
      >
        <text fg="red" attributes={DIM}>
          Terminal too small
        </text>
        <text> </text>
        <text>{`Current: ${columns}x${rows}`}</text>
        <text>{`Required: ${MIN_TERMINAL_COLUMNS}x${MIN_TERMINAL_ROWS}`}</text>
        <text> </text>
        <text attributes={DIM}>Please resize your terminal.</text>
      </box>
    );
  }

  if (ui.modal) {
    return (
      <ModalHost
        store={store}
        actions={actions}
        modal={ui.modal}
        request={detailRequest}
        events={interceptors.events}
        proxyPort={connection.proxyPort}
        caCertPath={connection.caCertPath}
        width={columns}
        height={rows}
      />
    );
  }

  if (loading && requests.length === 0) {
    return (
      <box flexDirection="column" width={columns} height={rows}>
        <box flexGrow={1} alignItems="center" justifyContent="center">
          <text>
            <span fg="cyan">{spinnerFrame}</span>
            <span> Loading...</span>
          </text>
        </box>
        <StatusBar hints={hints} width={columns} />
      </box>
    );
  }

  if (error) {
    return (
      <box flexDirection="column" width={columns} height={rows}>
        <box flexGrow={1} alignItems="center" justifyContent="center">
          <text fg="red">{`Error: ${error}`}</text>
        </box>
        <StatusBar message="Press 'q' to quit, 'r' to retry" hints={hints} width={columns} />
      </box>
    );
  }

  const hasDetail = detailRequest !== null;
  const listWidth = hasDetail ? Math.floor(columns * ui.listWidthRatio) : columns;

  return (
    <box flexDirection="column" width={columns} height={rows}>
      <box flexDirection="row" width={columns} height={contentHeight}>
        <ListPane
          requests={requests}
          selectedIndex={selectedIndex}
          cursorId={selection.selectedId}
          actions={actions}
          isActive={selection.activePanel === "list"}
          isHovered={ui.hoveredPanel === "list"}
          width={listWidth}
          height={contentHeight}
          showFullUrl={ui.showFullUrl}
          searchTerm={bodySearch ? undefined : filter.search}
          following={selection.following}
          pendingNewCount={selection.pendingNew}
          onSelectIndex={actions.selectIndex}
          onActivate={() => actions.setActivePanel("list")}
          onHoverChange={(hovered) => actions.setHoveredPanel(hovered ? "list" : null)}
        />
        {hasDetail && (
          <DetailPane
            request={detailRequest}
            width={columns - listWidth}
            height={contentHeight}
            isActive={selection.activePanel === "detail"}
            focusedSection={selection.focusedSection}
            expandedSections={selection.expandedSections}
            onActivate={() => actions.setActivePanel("detail")}
            onHoverChange={(hovered) => actions.setHoveredPanel(hovered ? "detail" : null)}
          />
        )}
      </box>

      {ui.filterOpen && (
        <FilterBar
          filter={filter}
          bodySearch={bodySearch}
          onFilterChange={handleFilterChange}
          width={columns}
        />
      )}

      <InfoBar
        interceptorErrorCount={interceptors.counts.error}
        requestCount={requests.length}
        interceptorCount={interceptors.count}
        startTime={connection.startTime}
        width={columns}
      />

      <StatusBar
        message={ui.statusMessage}
        filterActive={isFilterActive(filter) || bodySearch !== undefined}
        filterOpen={ui.filterOpen}
        hints={hints}
        interceptorCount={interceptors.count}
        interceptorErrorCount={interceptors.counts.error}
        width={columns}
      />
    </box>
  );
}
