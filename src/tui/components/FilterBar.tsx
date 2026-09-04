/** @jsxImportSource @opentui/react */

/**
 * Filter bar for the request list: free text (plain, `/regex/` or `body:` scope),
 * method, status range, bookmark state and source.
 *
 * Tab and Shift+Tab move between the fields; the text fields are OpenTUI
 * inputs and the cycling fields take the arrow keys. The filter applies as you
 * type, so Enter only closes the bar and Escape reverts it, both through the
 * command table.
 */

import React, { useEffect, useRef, useState } from "react";
import { useKeyboard } from "@opentui/react";
import type { BodySearchOptions, RequestFilter } from "../../shared/types.js";
import { parseBodyScopeInput } from "../../shared/body-search.js";
import {
  buildFilterState,
  getInitialSearchValue,
  METHOD_CYCLE,
  STATUS_CYCLE,
} from "./filter-fields.js";
import { attributes, BOLD, DIM } from "./styles.js";

const MAX_SEARCH_LENGTH = 200;
const FILTER_DEBOUNCE_MS = 150;
const SEARCH_FIELD_WIDTH = 28;
const SOURCE_FIELD_WIDTH = 12;
const FILTER_HELP_TEXT = "Tab=switch Enter=close Esc=cancel body:(req|res):error /re/";

type FilterField = "search" | "method" | "status" | "saved" | "source";
const FIELD_ORDER: FilterField[] = ["search", "method", "status", "saved", "source"];

export interface FilterBarProps {
  filter: RequestFilter;
  bodySearch?: BodySearchOptions;
  onFilterChange: (filter: RequestFilter, bodySearch: BodySearchOptions | undefined) => void;
  width: number;
}

const cycle = (current: number, length: number, direction: 1 | -1): number => {
  const total = length + 1; // index 0 is the "ALL" option
  return (current + direction + total) % total;
};

function CycleField({
  label,
  value,
  isSet,
  isFocused,
}: {
  label: string;
  value: string;
  isSet: boolean;
  isFocused: boolean;
}): React.ReactNode {
  return (
    <text wrapMode="none" flexShrink={0}>
      <span attributes={DIM}>{`  ${label}:`}</span>
      <span
        fg={isSet ? "yellow" : "white"}
        attributes={attributes({ bold: isFocused, underline: isFocused })}
      >
        {value}
      </span>
    </text>
  );
}

export function FilterBar({
  filter,
  bodySearch,
  onFilterChange,
  width,
}: FilterBarProps): React.ReactNode {
  // The inputs own their text, so their initial value must never change.
  const [initialSearch] = useState(() => getInitialSearchValue(filter, bodySearch));
  const [initialSource] = useState(() => filter.source ?? "");
  const [search, setSearch] = useState(initialSearch);
  const [source, setSource] = useState(initialSource);
  const [methodIndex, setMethodIndex] = useState(() => {
    if (filter.methods?.length === 1) {
      const index = METHOD_CYCLE.findIndex((method) => method === filter.methods?.[0]);
      return index >= 0 ? index + 1 : 0;
    }
    return 0;
  });
  const [statusIndex, setStatusIndex] = useState(() => {
    const index = STATUS_CYCLE.findIndex((status) => status === filter.statusRange);
    return index >= 0 ? index + 1 : 0;
  });
  const [savedIndex, setSavedIndex] = useState(filter.saved === true ? 1 : 0);
  const [focusedField, setFocusedField] = useState<FilterField>("search");

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const onFilterChangeRef = useRef(onFilterChange);
  onFilterChangeRef.current = onFilterChange;

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      const next = buildFilterState({ search, methodIndex, statusIndex, savedIndex, source });
      onFilterChangeRef.current(next.filter, next.bodySearch);
    }, FILTER_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [search, methodIndex, statusIndex, savedIndex, source]);

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

    // A focused input owns every other key, including the arrows.
    if (focusedField === "search" || focusedField === "source") {
      return;
    }

    const forwards = key.name === "right" || key.name === "down";
    const backwards = key.name === "left" || key.name === "up";
    if (!forwards && !backwards) {
      return;
    }
    key.stopPropagation();
    const direction = forwards ? 1 : -1;

    if (focusedField === "method") {
      setMethodIndex((previous) => cycle(previous, METHOD_CYCLE.length, direction));
    } else if (focusedField === "status") {
      setStatusIndex((previous) => cycle(previous, STATUS_CYCLE.length, direction));
    } else {
      setSavedIndex((previous) => (previous === 0 ? 1 : 0));
    }
  });

  // A scoped body search reads very differently from a URL filter, so the
  // whole field changes colour once the scope parses.
  const searchColour = parseBodyScopeInput(search.trim()) ? "cyan" : "white";

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
        textColor={searchColour}
        focusedTextColor={searchColour}
      />
      <CycleField
        label="method"
        value={methodIndex > 0 ? (METHOD_CYCLE[methodIndex - 1] ?? "ALL") : "ALL"}
        isSet={methodIndex > 0}
        isFocused={focusedField === "method"}
      />
      <CycleField
        label="status"
        value={statusIndex > 0 ? (STATUS_CYCLE[statusIndex - 1] ?? "ALL") : "ALL"}
        isSet={statusIndex > 0}
        isFocused={focusedField === "status"}
      />
      <CycleField
        label="saved"
        value={savedIndex > 0 ? "YES" : "ALL"}
        isSet={savedIndex > 0}
        isFocused={focusedField === "saved"}
      />
      <text wrapMode="none" flexShrink={0}>
        <span attributes={DIM}>{"  source:"}</span>
      </text>
      <input
        focused={focusedField === "source"}
        value={initialSource}
        onInput={setSource}
        placeholder="ALL"
        maxLength={MAX_SEARCH_LENGTH}
        width={SOURCE_FIELD_WIDTH}
        flexShrink={0}
        textColor={source ? "yellow" : "white"}
        focusedTextColor={source ? "yellow" : "white"}
      />
      <text wrapMode="none" attributes={DIM}>
        {` ${FILTER_HELP_TEXT}`}
      </text>
    </box>
  );
}
