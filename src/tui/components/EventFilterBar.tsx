/** @jsxImportSource @opentui/react */

/**
 * Filter bar for the interceptor event log: free text, log level and
 * interceptor name. Enter and Escape are command-table entries; this bar only
 * owns Tab and the arrow keys that cycle its two list fields.
 */

import React, { useEffect, useRef, useState } from "react";
import { useKeyboard } from "@opentui/react";
import type { EventFilter } from "../store/types.js";
import { attributes, BOLD, DIM } from "./styles.js";

const LEVEL_CYCLE = ["ALL", "ERROR", "WARN+"] as const;
const MAX_SEARCH_LENGTH = 200;
const FILTER_DEBOUNCE_MS = 150;
const SEARCH_FIELD_WIDTH = 28;

type FilterField = "search" | "level" | "interceptor";
const FIELD_ORDER: FilterField[] = ["search", "level", "interceptor"];

export interface EventFilterBarProps {
  filter: EventFilter;
  onFilterChange: (filter: EventFilter) => void;
  interceptorNames: string[];
  width: number;
}

const cycle = (current: number, length: number, direction: 1 | -1): number => {
  const total = length + 1; // index 0 is the "ALL" option
  return (current + direction + total) % total;
};

export const buildEventFilter = (
  search: string,
  levelIndex: number,
  interceptorIndex: number,
  interceptorNames: string[]
): EventFilter => {
  const result: EventFilter = {};
  if (search.trim()) {
    result.search = search.trim();
  }
  if (levelIndex === 1) {
    result.level = "error";
  } else if (levelIndex === 2) {
    result.level = "warn";
  }
  if (interceptorIndex > 0) {
    const name = interceptorNames[interceptorIndex - 1];
    if (name) {
      result.interceptor = name;
    }
  }
  return result;
};

export function EventFilterBar({
  filter,
  onFilterChange,
  interceptorNames,
  width,
}: EventFilterBarProps): React.ReactNode {
  const [initialSearch] = useState(() => filter.search ?? "");
  const [search, setSearch] = useState(initialSearch);
  const [levelIndex, setLevelIndex] = useState(() => {
    if (filter.level === "error") {
      return 1;
    }
    return filter.level === "warn" ? 2 : 0;
  });
  const [interceptorIndex, setInterceptorIndex] = useState(() => {
    const index = interceptorNames.findIndex((name) => name === filter.interceptor);
    return index >= 0 ? index + 1 : 0;
  });
  const [focusedField, setFocusedField] = useState<FilterField>("search");

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const onFilterChangeRef = useRef(onFilterChange);
  onFilterChangeRef.current = onFilterChange;
  const interceptorNamesRef = useRef(interceptorNames);
  interceptorNamesRef.current = interceptorNames;

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onFilterChangeRef.current(
        buildEventFilter(search, levelIndex, interceptorIndex, interceptorNamesRef.current)
      );
    }, FILTER_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [search, levelIndex, interceptorIndex]);

  useKeyboard((key) => {
    if (key.name === "tab") {
      key.stopPropagation();
      setFocusedField((previous) => {
        const currentIndex = FIELD_ORDER.indexOf(previous);
        const direction = key.shift ? -1 : 1;
        const nextIndex = (currentIndex + direction + FIELD_ORDER.length) % FIELD_ORDER.length;
        return FIELD_ORDER[nextIndex] ?? "search";
      });
      return;
    }

    if (focusedField === "search") {
      return;
    }

    const forwards = key.name === "right" || key.name === "down";
    const backwards = key.name === "left" || key.name === "up";
    if (!forwards && !backwards) {
      return;
    }
    key.stopPropagation();
    const direction = forwards ? 1 : -1;

    if (focusedField === "level") {
      setLevelIndex((previous) => cycle(previous, LEVEL_CYCLE.length - 1, direction));
    } else {
      setInterceptorIndex((previous) => cycle(previous, interceptorNames.length, direction));
    }
  });

  const currentLevel = LEVEL_CYCLE[levelIndex] ?? "ALL";
  const currentInterceptor =
    interceptorIndex > 0 ? (interceptorNames[interceptorIndex - 1] ?? "ALL") : "ALL";

  return (
    <box
      width={width}
      height={2}
      border={["bottom"]}
      borderStyle="single"
      paddingLeft={1}
      paddingRight={1}
      flexDirection="row"
    >
      <text wrapMode="none" flexShrink={0}>
        <span fg="cyan" attributes={BOLD}>
          /
        </span>
        <span> </span>
      </text>
      <input
        focused={focusedField === "search"}
        value={initialSearch}
        onInput={setSearch}
        maxLength={MAX_SEARCH_LENGTH}
        width={SEARCH_FIELD_WIDTH}
        flexShrink={0}
      />
      <text wrapMode="none" flexShrink={0}>
        <span attributes={DIM}>{"  level:"}</span>
        <span
          fg={levelIndex > 0 ? "yellow" : "white"}
          attributes={attributes({
            bold: focusedField === "level",
            underline: focusedField === "level",
          })}
        >
          {currentLevel}
        </span>
      </text>
      <text wrapMode="none" flexShrink={0}>
        <span attributes={DIM}>{"  interceptor:"}</span>
        <span
          fg={interceptorIndex > 0 ? "yellow" : "white"}
          attributes={attributes({
            bold: focusedField === "interceptor",
            underline: focusedField === "interceptor",
          })}
        >
          {currentInterceptor}
        </span>
      </text>
      <text wrapMode="none" attributes={DIM}>
        {"  Tab=switch Enter=close Esc=cancel"}
      </text>
    </box>
  );
}
