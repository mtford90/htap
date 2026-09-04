/** @jsxImportSource @opentui/react */

/**
 * Full-screen, scrollable, filterable view of interceptor runtime events,
 * newest first. The scrollbox owns the viewport and the command table owns
 * every key outside the filter bar.
 */

import React, { useCallback, useMemo } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { InterceptorEvent, InterceptorEventLevel } from "../../shared/types.js";
import { visibleHints } from "../commands/table.js";
import { useScroller } from "../hooks/useScroller.js";
import type { TuiActions, TuiStore } from "../store/store.js";
import type { EventFilter } from "../store/types.js";
import { eventLines, filterSummary, levelColour, passesFilter } from "./event-log-rows.js";
import { Hints } from "./Hints.js";
import { EventFilterBar } from "./EventFilterBar.js";
import { buildDivider, buildBottomBorder, buildModalHeader } from "./panel-chrome.js";
import { DIM } from "./styles.js";

/** Title, info row and divider. */
const HEADER_ROWS = 3;
/** Divider, hint bar and bottom border. */
const FOOTER_ROWS = 3;
const FILTER_BAR_ROWS = 2;

const EventRow = React.memo(function EventRow({
  text,
  level,
  isDetail,
}: {
  text: string;
  level: InterceptorEventLevel;
  isDetail: boolean;
}): React.ReactNode {
  if (isDetail) {
    return (
      <text height={1} flexShrink={0} wrapMode="none" fg="red" attributes={DIM}>
        {text}
      </text>
    );
  }
  if (level === "info") {
    return (
      <text height={1} flexShrink={0} wrapMode="none" attributes={DIM}>
        {text}
      </text>
    );
  }
  return (
    <text height={1} flexShrink={0} wrapMode="none" fg={levelColour(level)}>
      {text}
    </text>
  );
});

export interface InterceptorLogModalProps {
  store: TuiStore;
  actions: TuiActions;
  events: InterceptorEvent[];
  width: number;
  height: number;
}

export function InterceptorLogModal({
  store,
  actions,
  events,
  width,
  height,
}: InterceptorLogModalProps): React.ReactNode {
  const { filter, filterOpen } = useStore(
    store,
    useShallow((state) => state.modals.log)
  );
  const hints = useStore(store, useShallow(visibleHints));
  const { ref, scrollTop, syncScrollTop } = useScroller("log", actions);

  const interceptorNames = useMemo(
    () => [...new Set(events.map((event) => event.interceptor))].sort(),
    [events]
  );

  const filteredEvents = useMemo(
    () => events.filter((event) => passesFilter(event, filter)).reverse(),
    [events, filter]
  );

  const contentWidth = width - 4;
  const displayRows = useMemo(() => {
    const rows: { event: InterceptorEvent; text: string; isDetail: boolean; key: string }[] = [];
    for (const event of filteredEvents) {
      const { main, details } = eventLines(event, contentWidth);
      rows.push({ event, text: main, isDetail: false, key: `${event.seq}-m` });
      details.forEach((detail, index) => {
        rows.push({ event, text: detail, isDetail: true, key: `${event.seq}-d${index}` });
      });
    }
    return rows;
  }, [filteredEvents, contentWidth]);

  const handleFilterChange = useCallback(
    (next: EventFilter) => {
      actions.setLogFilter(next);
      ref.current?.scrollTo(0);
      syncScrollTop();
    },
    [actions, ref, syncScrollTop]
  );

  const viewportRows = height - HEADER_ROWS - FOOTER_ROWS - (filterOpen ? FILTER_BAR_ROWS : 0);
  const countPart = ` ${filteredEvents.length} event${filteredEvents.length === 1 ? "" : "s"} `;
  const headerBorder = buildModalHeader(
    "Interceptor Log",
    width,
    `${countPart} ${filterSummary(filter)} `
  );
  const divider = buildDivider(width);
  const footerBorder = buildBottomBorder(width);

  const filterBar = filterOpen ? (
    <EventFilterBar
      filter={filter}
      onFilterChange={handleFilterChange}
      interceptorNames={interceptorNames}
      width={width}
    />
  ) : null;

  const hasActiveFilter =
    filter.level !== undefined ||
    filter.interceptor !== undefined ||
    (filter.search !== undefined && filter.search.length > 0);

  const infoLine =
    displayRows.length > viewportRows
      ? `Showing ${scrollTop + 1}–${Math.min(scrollTop + viewportRows, displayRows.length)} of ${displayRows.length} rows`
      : `${displayRows.length} row${displayRows.length === 1 ? "" : "s"}`;

  return (
    <box flexDirection="column" width={width} height={height}>
      <text fg="cyan">{headerBorder}</text>
      <box height={1} flexShrink={0} paddingLeft={1} paddingRight={1}>
        <text wrapMode="none" attributes={DIM}>
          {filteredEvents.length === 0
            ? hasActiveFilter
              ? "No matching events | Press / to change filter"
              : "Waiting for interceptor events..."
            : infoLine}
        </text>
      </box>
      <text fg="cyan">{divider}</text>
      {filterBar}
      {filteredEvents.length === 0 ? (
        <box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
          <text attributes={DIM}>No interceptor events</text>
        </box>
      ) : (
        <scrollbox
          ref={ref}
          flexGrow={1}
          flexBasis={0}
          minHeight={0}
          viewportCulling
          scrollbarOptions={{ visible: false }}
          contentOptions={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1 }}
        >
          {displayRows.map((row) => (
            <EventRow
              key={row.key}
              text={row.text}
              level={row.event.level}
              isDetail={row.isDetail}
            />
          ))}
        </scrollbox>
      )}
      <text fg="cyan">{divider}</text>
      <box height={1} flexShrink={0} paddingLeft={1} paddingRight={1}>
        <Hints hints={hints} />
      </box>
      <text fg="cyan">{footerBorder}</text>
    </box>
  );
}
