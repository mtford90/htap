/** @jsxImportSource @opentui/react */

/**
 * Bottom bar: a transient message, the filter-bar prompt, or the keybinding
 * hints the command table says apply to the current state.
 */

import React from "react";
import type { CommandHint } from "../commands/table.js";
import { Hints } from "./Hints.js";
import { BOLD, DIM } from "./styles.js";

export interface StatusBarProps {
  message?: string;
  filterActive?: boolean;
  /** While the filter bar has the keyboard, the main-view hints do not apply. */
  filterOpen?: boolean;
  hints: readonly CommandHint[];
  interceptorCount?: number;
  interceptorErrorCount?: number;
  width: number;
}

const plural = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export function StatusBar({
  message,
  filterActive,
  filterOpen,
  hints,
  interceptorCount = 0,
  interceptorErrorCount = 0,
  width,
}: StatusBarProps): React.ReactNode {
  const badges: React.ReactNode[] = [];
  if (interceptorErrorCount > 0) {
    badges.push(
      <span key="errors" fg="red" attributes={BOLD}>
        {`[${plural(interceptorErrorCount, "error")}]`}
      </span>,
      <span key="errors-sep" attributes={DIM}>
        {" │ "}
      </span>
    );
  }
  if (interceptorCount > 0) {
    badges.push(
      <span key="interceptors" fg="magenta" attributes={BOLD}>
        {`[${plural(interceptorCount, "interceptor")}]`}
      </span>,
      <span key="interceptors-sep" attributes={DIM}>
        {" │ "}
      </span>
    );
  }
  if (filterActive) {
    badges.push(
      <span key="filtered" fg="yellow" attributes={BOLD}>
        [FILTERED]
      </span>,
      <span key="filtered-sep" attributes={DIM}>
        {" │ "}
      </span>
    );
  }

  return (
    <box
      width={width}
      height={2}
      border={["top"]}
      borderStyle="single"
      paddingLeft={1}
      paddingRight={1}
      flexDirection="row"
    >
      {message ? (
        <text wrapMode="none" fg="yellow">
          {message}
        </text>
      ) : filterOpen ? (
        <text wrapMode="none">
          <span fg="cyan" attributes={BOLD}>
            Esc
          </span>
          <span attributes={DIM}> close filter</span>
        </text>
      ) : (
        <>
          {badges.length > 0 && <text wrapMode="none">{badges}</text>}
          <Hints hints={hints} />
        </>
      )}
    </box>
  );
}
