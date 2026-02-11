/**
 * Shared hint rendering used by StatusBar and modal hint bars.
 * Renders "key action │ key action │ …" with coloured styling
 * and drops hints from the right when they exceed the available width.
 */

import React, { useMemo } from "react";
import { Text } from "ink";

export interface HintItem {
  key: string;
  action: string;
}

interface HintContentProps {
  hints: HintItem[];
  /** Available character width for the hints. When omitted, all hints are shown. */
  availableWidth?: number;
}

const SEPARATOR_WIDTH = 3; // " │ "

/** Width in visible characters of a single hint: "key action" */
function hintWidth(hint: HintItem): number {
  return hint.key.length + 1 + hint.action.length;
}

/**
 * Renders a list of key hints with consistent styling:
 * cyan bold keys, dim actions, dim separators.
 * Drops hints from the right and appends "…" when they don't fit.
 *
 * Returns a `<Text>` element — nest inside another `<Text>` or use directly.
 */
export function HintContent({ hints, availableWidth }: HintContentProps): React.ReactElement {
  const { fittingHints, truncated } = useMemo(() => {
    if (availableWidth === undefined) return { fittingHints: hints, truncated: false };

    let remaining = availableWidth;
    const fitting: HintItem[] = [];

    for (let i = 0; i < hints.length; i++) {
      const hint = hints[i];
      if (!hint) break;
      const w = hintWidth(hint) + (i < hints.length - 1 ? SEPARATOR_WIDTH : 0);

      if (w <= remaining) {
        fitting.push(hint);
        remaining -= w;
      } else {
        return { fittingHints: fitting, truncated: true };
      }
    }

    return { fittingHints: fitting, truncated: false };
  }, [hints, availableWidth]);

  return (
    <Text>
      {fittingHints.map((hint, index) => (
        <React.Fragment key={hint.key}>
          <Text color="cyan" bold>
            {hint.key}
          </Text>
          <Text dimColor> {hint.action}</Text>
          {index < fittingHints.length - 1 && <Text dimColor> │ </Text>}
        </React.Fragment>
      ))}
      {truncated && <Text dimColor>…</Text>}
    </Text>
  );
}
