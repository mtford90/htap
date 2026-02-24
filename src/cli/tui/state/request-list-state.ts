import type { CapturedRequestSummary } from "../../../shared/types.js";

export interface SelectedIndexOptions {
  requests: CapturedRequestSummary[];
  selectedRequestId: string | null;
  following: boolean;
}

export function resolveSelectedIndex({
  requests,
  selectedRequestId,
  following,
}: SelectedIndexOptions): number {
  if (requests.length === 0) {
    return -1;
  }

  if (selectedRequestId) {
    const matchedIndex = requests.findIndex((request) => request.id === selectedRequestId);
    if (matchedIndex !== -1) {
      return matchedIndex;
    }
  }

  if (following) {
    return 0;
  }

  return 0;
}

export interface ScrollOffsetOptions {
  requests: CapturedRequestSummary[];
  following: boolean;
  topVisibleRequestId: string | null;
  selectedIndex: number;
  maxListOffset: number;
}

export function resolveEffectiveListScrollOffset({
  requests,
  following,
  topVisibleRequestId,
  selectedIndex,
  maxListOffset,
}: ScrollOffsetOptions): number {
  if (following) {
    return 0;
  }

  if (topVisibleRequestId) {
    const topIndex = requests.findIndex((request) => request.id === topVisibleRequestId);
    if (topIndex !== -1) {
      return Math.min(topIndex, maxListOffset);
    }
  }

  if (selectedIndex <= 0) {
    return 0;
  }

  return Math.min(selectedIndex, maxListOffset);
}

export function countPrependedRequests(
  previousRequestIds: string[],
  nextRequests: CapturedRequestSummary[]
): number {
  if (previousRequestIds.length === 0 || nextRequests.length === 0) {
    return 0;
  }

  const previousIdSet = new Set(previousRequestIds);
  let prependedCount = 0;

  for (const request of nextRequests) {
    if (previousIdSet.has(request.id)) {
      break;
    }

    prependedCount += 1;
  }

  return prependedCount;
}
