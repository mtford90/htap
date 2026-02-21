/**
 * Shared hint rendering used by StatusBar and modal hint bars.
 * Renders "key action │ key action │ …" with coloured styling.
 */

import React from "react";
import { Text } from "ink";

export interface HintItem {
  key: string;
  action: string;
}

interface HintContentProps {
  hints: HintItem[];
}

/**
 * Renders a list of key hints with consistent styling:
 * cyan bold keys, dim actions, dim separators.
 *
 * Returns a `<Text>` element — nest inside another `<Text>` or use directly.
 */
export function HintContent({ hints }: HintContentProps): React.ReactElement {
  return (
    <Text>
      {hints.map((hint, index) => (
        <React.Fragment key={hint.key}>
          <Text color="cyan" bold>
            {hint.key}
          </Text>
          <Text dimColor> {hint.action}</Text>
          {index < hints.length - 1 && <Text dimColor> │ </Text>}
        </React.Fragment>
      ))}
    </Text>
  );
}
