import type { RequestFilter } from "../../../shared/types.js";

/**
 * Check whether a filter has any active conditions.
 */
export function isFilterActive(filter: RequestFilter): boolean {
  return (
    (filter.methods !== undefined && filter.methods.length > 0) ||
    filter.statusRange !== undefined ||
    (filter.search !== undefined && filter.search.length > 0)
  );
}
