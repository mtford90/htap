/**
 * Status bar showing keybinding hints at the bottom of the TUI.
 * Hints are filtered based on the current focus/selection context.
 */

import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { HintContent, type HintItem } from "./HintContent.js";

interface StatusBarContext {
  activePanel: "list" | "accordion";
  hasSelection: boolean;
  hasRequests: boolean;
  onBodySection: boolean;
  onViewableBodySection: boolean;
}

interface KeyHint extends HintItem {
  visible?: (ctx: StatusBarContext) => boolean;
}

const KEY_HINTS: KeyHint[] = [
  { key: "j/k/g/G", action: "nav" },
  { key: "^f/^b", action: "page", visible: (ctx) => ctx.activePanel === "list" },
  { key: "Tab", action: "panel" },
  { key: "1-5", action: "section" },
  { key: "Enter", action: "view", visible: (ctx) => ctx.onViewableBodySection },
  { key: "c", action: "curl", visible: (ctx) => ctx.hasSelection },
  { key: "H", action: "HAR", visible: (ctx) => ctx.hasRequests },
  { key: "y", action: "yank", visible: (ctx) => ctx.onBodySection },
  { key: "s", action: "export", visible: (ctx) => ctx.onBodySection },
  { key: "u", action: "URL" },
  { key: "/", action: "filter" },
  { key: "i", action: "info" },
  { key: "?", action: "help" },
  { key: "q", action: "quit" },
];

export interface StatusBarProps {
  message?: string;
  filterActive?: boolean;
  /** When true the filter bar is open and capturing input, so main-view hints are suppressed. */
  filterOpen?: boolean;
  activePanel?: "list" | "accordion";
  hasSelection?: boolean;
  hasRequests?: boolean;
  onBodySection?: boolean;
  onViewableBodySection?: boolean;
  /** Number of active interceptors; shown as a badge when > 0. */
  interceptorCount?: number;
  /** Terminal width in columns — used to constrain the hint bar. */
  width?: number;
}

/**
 * Returns hints visible for the given context. All new props default to true
 * so the component remains backwards-compatible when no context is passed.
 */
export function getVisibleHints({
  activePanel = "list",
  hasSelection = true,
  hasRequests = true,
  onBodySection = true,
  onViewableBodySection = false,
}: Pick<StatusBarProps, "activePanel" | "hasSelection" | "hasRequests" | "onBodySection" | "onViewableBodySection">): KeyHint[] {
  const ctx: StatusBarContext = { activePanel, hasSelection, hasRequests, onBodySection, onViewableBodySection };
  return KEY_HINTS.filter((hint) => !hint.visible || hint.visible(ctx));
}

const SEPARATOR_WIDTH = 3; // " │ "
const PADDING_WIDTH = 2; // paddingX={1} each side

export function StatusBar({
  message,
  filterActive,
  filterOpen,
  activePanel,
  hasSelection,
  hasRequests,
  onBodySection,
  onViewableBodySection,
  interceptorCount,
  width,
}: StatusBarProps): React.ReactElement {
  const visibleHints = useMemo(
    () => getVisibleHints({ activePanel, hasSelection, hasRequests, onBodySection, onViewableBodySection }),
    [activePanel, hasSelection, hasRequests, onBodySection, onViewableBodySection],
  );

  // Calculate available width for hints, accounting for prefix badges
  const hintsAvailableWidth = useMemo(() => {
    if (!width) return undefined;

    let prefixWidth = 0;
    if (interceptorCount !== undefined && interceptorCount > 0) {
      const badge = `[${interceptorCount} interceptor${interceptorCount === 1 ? "" : "s"}]`;
      prefixWidth += badge.length + SEPARATOR_WIDTH;
    }
    if (filterActive) {
      prefixWidth += "[FILTERED]".length + SEPARATOR_WIDTH;
    }

    return width - PADDING_WIDTH - prefixWidth;
  }, [width, interceptorCount, filterActive]);

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
          <HintContent hints={visibleHints} availableWidth={hintsAvailableWidth} />
        </Text>
      )}
    </Box>
  );
}
