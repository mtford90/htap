/** @jsxImportSource @opentui/react */

/**
 * Full-screen, scrollable, filterable view of interceptor runtime events,
 * newest first.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import { useKeyboard } from "@opentui/react";
import type { InterceptorEvent, InterceptorEventLevel } from "../../shared/types.js";
import { Hints, type HintItem } from "./Hints.js";
import { EventFilterBar, type EventFilter } from "./EventFilterBar.js";
import { buildDivider, buildBottomBorder, buildModalHeader } from "./panel-chrome.js";
import { DIM } from "./styles.js";

const LOG_MODAL_HINTS: HintItem[] = [
  { key: "j/k", action: "nav" },
  { key: "^u/^d", action: "half-page" },
  { key: "g/G", action: "top/bottom" },
  { key: "/", action: "filter" },
  { key: "q/Esc", action: "close" },
];

/** Title, info row and divider. */
const HEADER_ROWS = 3;
/** Divider, hint bar and bottom border. */
const FOOTER_ROWS = 3;
const FILTER_BAR_ROWS = 2;
const DETAIL_INDENT = "    ";

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
};

const levelColour = (level: InterceptorEventLevel): string | undefined => {
  if (level === "error") {
    return "red";
  }
  return level === "warn" ? "yellow" : undefined;
};

const filterSummary = (filter: EventFilter): string => {
  const parts: string[] = [];
  if (filter.level === "error") {
    parts.push("errors");
  } else if (filter.level === "warn") {
    parts.push("warn+");
  } else {
    parts.push("all");
  }
  if (filter.interceptor) {
    parts.push(filter.interceptor);
  }
  if (filter.search) {
    parts.push(`"${filter.search}"`);
  }
  return parts.join(" ");
};

export const passesFilter = (event: InterceptorEvent, filter: EventFilter): boolean => {
  if (filter.level === "error" && event.level !== "error") {
    return false;
  }
  if (filter.level === "warn" && event.level !== "warn" && event.level !== "error") {
    return false;
  }
  if (filter.interceptor && event.interceptor !== filter.interceptor) {
    return false;
  }
  if (filter.search && !event.message.toLowerCase().includes(filter.search.toLowerCase())) {
    return false;
  }
  return true;
};

const clip = (text: string, maxWidth: number): string =>
  text.length > maxWidth ? `${text.slice(0, Math.max(0, maxWidth - 1))}…` : text;

/** One event becomes a main line plus one line per error-detail row. */
export const eventLines = (
  event: InterceptorEvent,
  maxWidth: number
): { main: string; details: string[] } => {
  const prefix = `[${formatTime(event.timestamp)}] [${event.level.toUpperCase().padEnd(5)}] [${event.interceptor}] `;
  const main = `${prefix}${clip(event.message, Math.max(0, maxWidth - prefix.length))}`;

  const details = event.error
    ? event.error
        .split("\n")
        .map((line) => `${DETAIL_INDENT}${clip(line, Math.max(0, maxWidth - DETAIL_INDENT.length))}`)
    : [];

  return { main, details };
};

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
      <text wrapMode="none" fg="red" attributes={DIM}>
        {text}
      </text>
    );
  }
  if (level === "info") {
    return (
      <text wrapMode="none" attributes={DIM}>
        {text}
      </text>
    );
  }
  return (
    <text wrapMode="none" fg={levelColour(level)}>
      {text}
    </text>
  );
});

export interface InterceptorLogModalProps {
  events: InterceptorEvent[];
  width: number;
  height: number;
  onClose: () => void;
}

export function InterceptorLogModal({
  events,
  width,
  height,
  onClose,
}: InterceptorLogModalProps): React.ReactNode {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [filter, setFilter] = useState<EventFilter>({});
  const [showFilter, setShowFilter] = useState(false);
  const preOpenFilterRef = useRef<EventFilter>({});

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

  const availableHeight =
    height - HEADER_ROWS - FOOTER_ROWS - (showFilter ? FILTER_BAR_ROWS : 0);
  const maxScrollOffset = Math.max(0, displayRows.length - availableHeight);

  const handleFilterChange = useCallback((next: EventFilter) => {
    setFilter(next);
    setScrollOffset(0);
  }, []);

  const handleFilterCancel = useCallback(() => {
    setFilter(preOpenFilterRef.current);
    setScrollOffset(0);
    setShowFilter(false);
  }, []);

  useKeyboard((key) => {
    if (showFilter) {
      return;
    }
    key.stopPropagation();

    if (key.name === "escape" || key.sequence === "q") {
      onClose();
      return;
    }
    if (key.sequence === "/") {
      preOpenFilterRef.current = filter;
      setShowFilter(true);
      return;
    }

    const halfPage = Math.floor(availableHeight / 2);
    const clamp = (value: number): number => Math.min(Math.max(value, 0), maxScrollOffset);

    if (key.sequence === "j" || key.name === "down") {
      setScrollOffset((previous) => clamp(previous + 1));
    } else if (key.sequence === "k" || key.name === "up") {
      setScrollOffset((previous) => clamp(previous - 1));
    } else if (key.ctrl && key.name === "d") {
      setScrollOffset((previous) => clamp(previous + halfPage));
    } else if (key.ctrl && key.name === "u") {
      setScrollOffset((previous) => clamp(previous - halfPage));
    } else if (key.sequence === "g") {
      setScrollOffset(0);
    } else if (key.sequence === "G") {
      setScrollOffset(maxScrollOffset);
    }
  });

  const countPart = ` ${filteredEvents.length} event${filteredEvents.length === 1 ? "" : "s"} `;
  const headerBorder = buildModalHeader(
    "Interceptor Log",
    width,
    `${countPart} ${filterSummary(filter)} `
  );
  const divider = buildDivider(width);
  const footerBorder = buildBottomBorder(width);

  const filterBar = showFilter ? (
    <EventFilterBar
      filter={filter}
      onFilterChange={handleFilterChange}
      onClose={() => setShowFilter(false)}
      onCancel={handleFilterCancel}
      interceptorNames={interceptorNames}
      width={width}
    />
  ) : null;

  const hasActiveFilter =
    filter.level !== undefined ||
    filter.interceptor !== undefined ||
    (filter.search !== undefined && filter.search.length > 0);

  if (filteredEvents.length === 0) {
    return (
      <box flexDirection="column" width={width} height={height}>
        <text fg="cyan">{headerBorder}</text>
        <box height={1} paddingLeft={1} paddingRight={1}>
          <text wrapMode="none" attributes={DIM}>
            {hasActiveFilter
              ? "No matching events | Press / to change filter"
              : "Waiting for interceptor events..."}
          </text>
        </box>
        <text fg="cyan">{divider}</text>
        {filterBar}
        <box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
          <text attributes={DIM}>No interceptor events</text>
        </box>
        <text fg="cyan">{divider}</text>
        <box height={1} paddingLeft={1} paddingRight={1}>
          <Hints hints={LOG_MODAL_HINTS} />
        </box>
        <text fg="cyan">{footerBorder}</text>
      </box>
    );
  }

  const visibleSlice = displayRows.slice(scrollOffset, scrollOffset + availableHeight);

  return (
    <box flexDirection="column" width={width} height={height}>
      <text fg="cyan">{headerBorder}</text>
      <box height={1} paddingLeft={1} paddingRight={1}>
        <text wrapMode="none" attributes={DIM}>
          {displayRows.length > availableHeight
            ? `Showing ${scrollOffset + 1}–${Math.min(scrollOffset + availableHeight, displayRows.length)} of ${displayRows.length} rows`
            : `${displayRows.length} row${displayRows.length === 1 ? "" : "s"}`}
        </text>
      </box>
      <text fg="cyan">{divider}</text>
      {filterBar}
      <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingRight={1}>
        {visibleSlice.map((row) => (
          <EventRow key={row.key} text={row.text} level={row.event.level} isDetail={row.isDetail} />
        ))}
      </box>
      <text fg="cyan">{divider}</text>
      <box height={1} paddingLeft={1} paddingRight={1}>
        <Hints hints={LOG_MODAL_HINTS} />
      </box>
      <text fg="cyan">{footerBorder}</text>
    </box>
  );
}
