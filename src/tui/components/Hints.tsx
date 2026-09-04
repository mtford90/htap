/** @jsxImportSource @opentui/react */

/**
 * The `key action │ key action` strip used by the status bar and every modal.
 */

import React from "react";
import { BOLD, DIM } from "./styles.js";

export interface HintItem {
  key: string;
  action: string;
}

export const Hints = React.memo(function Hints({
  hints,
}: {
  hints: readonly HintItem[];
}): React.ReactNode {
  return (
    <text wrapMode="none">
      {hints.flatMap((hint, index) => [
        <span key={`${hint.key}-k`} fg="cyan" attributes={BOLD}>
          {hint.key}
        </span>,
        <span key={`${hint.key}-a`} attributes={DIM}>
          {` ${hint.action}`}
        </span>,
        ...(index < hints.length - 1
          ? [
              <span key={`${hint.key}-s`} attributes={DIM}>
                {" │ "}
              </span>,
            ]
          : []),
      ])}
    </text>
  );
});
