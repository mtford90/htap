/**
 * Status bar showing keybinding hints at the bottom of the TUI.
 * Hints are filtered based on the current focus/selection context.
 */

import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { HintContent } from "./HintContent.js";
import type { HintItem } from "./HintContent.js";

interface StatusBarContext {
  hasSelection: boolean;
  hasRequests: boolean;
  onViewableBodySection: boolean;
}

interface KeyHint extends HintItem {
  visible?: (ctx: StatusBarContext) => boolean;
}

const KEY_HINTS: KeyHint[] = [
  { key: "j/k", action: "nav" },
  { key: "Tab", action: "panel" },
  { key: "Enter", action: "view", visible: (ctx) => ctx.onViewableBodySection },
  { key: "e", action: "export", visible: (ctx) => ctx.hasSelection },
  { key: "R", action: "replay", visible: (ctx) => ctx.hasSelection },
  { key: "b", action: "bookmark", visible: (ctx) => ctx.hasSelection },
  { key: "x", action: "clear", visible: (ctx) => ctx.hasRequests },
  { key: "u", action: "URL" },
  { key: "/", action: "filter" },
  { key: "?", action: "help" },
  { key: "q", action: "quit" },
];

export interface StatusBarProps {
  message?: string;
  filterActive?: boolean;
  /** When true the filter bar is open and capturing input, so main-view hints are suppressed. */
  filterOpen?: boolean;
  hasSelection?: boolean;
  hasRequests?: boolean;
  onViewableBodySection?: boolean;
  /** Number of active interceptors; shown as a badge when > 0. */
  interceptorCount?: number;
  /** Number of interceptor error events; shown as a red badge when > 0. */
  interceptorErrorCount?: number;
}

/**
 * Returns hints visible for the given context. Props default to false
 * so bare `<StatusBar />` only shows unconditional hints.
 */
export function getVisibleHints({
  hasSelection = false,
  hasRequests = false,
  onViewableBodySection = false,
}: Pick<StatusBarProps, "hasSelection" | "hasRequests" | "onViewableBodySection">): KeyHint[] {
  const ctx: StatusBarContext = { hasSelection, hasRequests, onViewableBodySection };
  return KEY_HINTS.filter((hint) => !hint.visible || hint.visible(ctx));
}

export function StatusBar({
  message,
  filterActive,
  filterOpen,
  hasSelection,
  hasRequests,
  onViewableBodySection,
  interceptorCount,
  interceptorErrorCount,
}: StatusBarProps): React.ReactElement {
  const visibleHints = useMemo(
    () => getVisibleHints({ hasSelection, hasRequests, onViewableBodySection }),
    [hasSelection, hasRequests, onViewableBodySection],
  );

  return (
    <Box
      borderStyle="single"
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      paddingX={1}
      height={2}
    >
      {message ? (
        <Text color="yellow">{message}</Text>
      ) : filterOpen ? (
        <>
          <Text color="cyan" bold>Esc</Text>
          <Text dimColor> close filter</Text>
        </>
      ) : (
        <Text>
          {interceptorErrorCount !== undefined && interceptorErrorCount > 0 && (
            <>
              <Text color="red" bold>[{interceptorErrorCount} error{interceptorErrorCount === 1 ? "" : "s"}]</Text>
              <Text dimColor> │ </Text>
            </>
          )}
          {interceptorCount !== undefined && interceptorCount > 0 && (
            <>
              <Text color="magenta" bold>[{interceptorCount} interceptor{interceptorCount === 1 ? "" : "s"}]</Text>
              <Text dimColor> │ </Text>
            </>
          )}
          {filterActive && (
            <>
              <Text color="yellow" bold>[FILTERED]</Text>
              <Text dimColor> │ </Text>
            </>
          )}
          {/* key forces yoga to re-measure when hint count changes, working around
             a stale text measurement cache during rapid loading→connected transitions */}
          <HintContent key={visibleHints.length} hints={visibleHints} />
        </Text>
      )}
    </Box>
  );
}
