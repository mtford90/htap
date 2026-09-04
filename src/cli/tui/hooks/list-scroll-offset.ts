/**
 * Viewport anchoring for the Ink request list.
 *
 * The OpenTUI list hands this to `<scrollbox>` instead, so this lives here
 * until the Ink tree goes.
 */

import type { CapturedRequestSummary } from "../../../shared/types.js";

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
