/** @jsxImportSource @opentui/react */

/**
 * Filter bar for the request list: free text (plain, `/regex/` or `body:` scope),
 * method, status range, bookmark state and source.
 *
 * Tab and Shift+Tab move between the fields; the text fields take characters
 * and the cycling fields take the arrow keys. The filter applies as you type,
 * so Enter only closes the bar and Escape reverts it.
 */

import React, { useEffect, useRef, useState } from "react";
import { useKeyboard } from "@opentui/react";
import type { BodySearchOptions, RequestFilter } from "../../shared/types.js";
import { parseUrlSearchInput } from "../../shared/regex-filter.js";
import { parseBodyScopeInput, parseBodySearchTarget } from "../../shared/body-search.js";
import { attributes, BOLD, DIM } from "./styles.js";

const METHOD_CYCLE = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const STATUS_CYCLE = ["2xx", "3xx", "4xx", "5xx"] as const;
const MAX_SEARCH_LENGTH = 200;
const FILTER_DEBOUNCE_MS = 150;
const BODY_SCOPE_PREFIX = "body:";
const FILTER_HELP_TEXT = "Tab=switch Enter=close Esc=cancel body:(req|res):error /re/";

type FilterField = "search" | "method" | "status" | "saved" | "source";
const FIELD_ORDER: FilterField[] = ["search", "method", "status", "saved", "source"];

export interface FilterBarProps {
  filter: RequestFilter;
  bodySearch?: BodySearchOptions;
  onFilterChange: (filter: RequestFilter, bodySearch: BodySearchOptions | undefined) => void;
  onClose: () => void;
  /** Escape reverts to the state the bar opened with. */
  onCancel: () => void;
  width: number;
}

const getInitialSearchValue = (
  filter: RequestFilter,
  bodySearch: BodySearchOptions | undefined
): string => {
  if (bodySearch) {
    if (bodySearch.target === "request") {
      return `body:req:${bodySearch.query}`;
    }
    if (bodySearch.target === "response") {
      return `body:res:${bodySearch.query}`;
    }
    return `body:${bodySearch.query}`;
  }
  if (filter.regex) {
    return `/${filter.regex}/${filter.regexFlags ?? ""}`;
  }
  return filter.search ?? "";
};

export interface BodySearchDisplayParts {
  bodyPrefix: string;
  targetPrefix?: string;
  query: string;
}

/** Splits `body:req:error` so each part can be coloured differently. */
export const getBodySearchDisplayParts = (input: string): BodySearchDisplayParts | undefined => {
  if (!input.toLowerCase().startsWith(BODY_SCOPE_PREFIX)) {
    return undefined;
  }

  const bodyPrefix = input.slice(0, BODY_SCOPE_PREFIX.length);
  const rest = input.slice(BODY_SCOPE_PREFIX.length);
  if (!rest) {
    return { bodyPrefix, query: "" };
  }

  const firstColon = rest.indexOf(":");
  if (firstColon === -1) {
    return { bodyPrefix, query: rest };
  }

  if (!parseBodySearchTarget(rest.slice(0, firstColon))) {
    return { bodyPrefix, query: rest };
  }

  return {
    bodyPrefix,
    targetPrefix: rest.slice(0, firstColon + 1),
    query: rest.slice(firstColon + 1),
  };
};

const getBodyTargetColour = (targetPrefix: string): string => {
  const target = parseBodySearchTarget(targetPrefix.slice(0, -1));
  if (target === "request") {
    return "yellow";
  }
  return target === "response" ? "magenta" : "blue";
};

interface FilterState {
  filter: RequestFilter;
  bodySearch?: BodySearchOptions;
}

interface FieldValues {
  search: string;
  methodIndex: number;
  statusIndex: number;
  savedIndex: number;
  source: string;
}

/** Turns the bar's fields into the filter the daemon understands. */
export const buildFilterState = ({
  search,
  methodIndex,
  statusIndex,
  savedIndex,
  source,
}: FieldValues): FilterState => {
  const result: RequestFilter = {};
  let bodySearch: BodySearchOptions | undefined;

  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    const parsedBodyScope = parseBodyScopeInput(trimmedSearch);
    if (parsedBodyScope) {
      bodySearch = { query: parsedBodyScope.query, target: parsedBodyScope.target };
    } else {
      try {
        const parsed = parseUrlSearchInput(trimmedSearch);
        if (parsed.regex) {
          result.regex = parsed.regex.pattern;
          if (parsed.regex.flags) {
            result.regexFlags = parsed.regex.flags;
          }
        } else if (parsed.search) {
          result.search = parsed.search;
        }
      } catch {
        // A half-typed regex literal should still filter, so fall back to a
        // substring match rather than showing an error.
        result.search = trimmedSearch;
      }
    }
  }

  if (methodIndex > 0) {
    const method = METHOD_CYCLE[methodIndex - 1];
    if (method) {
      result.methods = [method];
    }
  }
  if (statusIndex > 0) {
    const status = STATUS_CYCLE[statusIndex - 1];
    if (status) {
      result.statusRange = status;
    }
  }
  if (savedIndex > 0) {
    result.saved = true;
  }
  if (source.trim()) {
    result.source = source.trim();
  }

  return { filter: result, bodySearch };
};

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
    <text wrapMode="none">
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
  onClose,
  onCancel,
  width,
}: FilterBarProps): React.ReactNode {
  const [search, setSearch] = useState(() => getInitialSearchValue(filter, bodySearch));
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
  const [source, setSource] = useState(filter.source ?? "");
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
    key.stopPropagation();

    if (key.name === "escape") {
      onCancel();
      return;
    }
    if (key.name === "return") {
      onClose();
      return;
    }
    if (key.name === "tab") {
      setFocusedField((previous) => {
        const currentIndex = FIELD_ORDER.indexOf(previous);
        const direction = key.shift ? -1 : 1;
        const nextIndex = (currentIndex + direction + FIELD_ORDER.length) % FIELD_ORDER.length;
        return FIELD_ORDER[nextIndex] ?? "search";
      });
      return;
    }

    const isText = focusedField === "search" || focusedField === "source";
    if (isText) {
      const setValue = focusedField === "search" ? setSearch : setSource;
      if (key.name === "backspace" || key.name === "delete") {
        setValue((previous) => previous.slice(0, -1));
        return;
      }
      if (key.sequence.length === 1 && !key.ctrl && !key.meta) {
        setValue((previous) =>
          previous.length >= MAX_SEARCH_LENGTH ? previous : previous + key.sequence
        );
      }
      return;
    }

    const forwards = key.name === "right" || key.name === "down";
    const backwards = key.name === "left" || key.name === "up";
    if (!forwards && !backwards) {
      return;
    }
    const direction = forwards ? 1 : -1;

    if (focusedField === "method") {
      setMethodIndex((previous) => cycle(previous, METHOD_CYCLE.length, direction));
    } else if (focusedField === "status") {
      setStatusIndex((previous) => cycle(previous, STATUS_CYCLE.length, direction));
    } else {
      setSavedIndex((previous) => (previous === 0 ? 1 : 0));
    }
  });

  const displayParts = getBodySearchDisplayParts(search);

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
      <text wrapMode="none">
        <span fg="cyan" attributes={BOLD}>
          /
        </span>
        <span> </span>
        {displayParts ? (
          [
            <span key="prefix" fg="cyan" attributes={BOLD}>
              {displayParts.bodyPrefix}
            </span>,
            displayParts.targetPrefix ? (
              <span
                key="target"
                fg={getBodyTargetColour(displayParts.targetPrefix)}
                attributes={BOLD}
              >
                {displayParts.targetPrefix}
              </span>
            ) : null,
            <span key="query">{displayParts.query}</span>,
          ]
        ) : (
          <span>{search}</span>
        )}
        {focusedField === "search" ? <span fg="cyan">█</span> : null}
      </text>
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
      <text wrapMode="none">
        <span attributes={DIM}>{"  source:"}</span>
        <span
          fg={source ? "yellow" : "white"}
          attributes={attributes({
            bold: focusedField === "source",
            underline: focusedField === "source",
          })}
        >
          {source || "ALL"}
        </span>
        {focusedField === "source" ? <span fg="cyan">█</span> : null}
      </text>
      <text wrapMode="none" attributes={DIM}>
        {`  ${FILTER_HELP_TEXT}`}
      </text>
    </box>
  );
}
