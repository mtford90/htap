/**
 * The request filter bar's fields, and the daemon filter they add up to.
 */

import type { BodySearchOptions, RequestFilter } from "../../shared/types.js";
import { parseUrlSearchInput } from "../../shared/regex-filter.js";
import { parseBodyScopeInput } from "../../shared/body-search.js";

export const METHOD_CYCLE = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export const STATUS_CYCLE = ["2xx", "3xx", "4xx", "5xx"] as const;

export const getInitialSearchValue = (
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
