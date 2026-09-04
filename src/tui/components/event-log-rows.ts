/**
 * How one interceptor event becomes rows of text in the log modal.
 */

import type { InterceptorEvent, InterceptorEventLevel } from "../../shared/types.js";
import type { EventFilter } from "../store/types.js";

const DETAIL_INDENT = "    ";

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
};

export const levelColour = (level: InterceptorEventLevel): string | undefined => {
  if (level === "error") {
    return "red";
  }
  return level === "warn" ? "yellow" : undefined;
};

export const filterSummary = (filter: EventFilter): string => {
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
        .map(
          (line) => `${DETAIL_INDENT}${clip(line, Math.max(0, maxWidth - DETAIL_INDENT.length))}`
        )
    : [];

  return { main, details };
};
