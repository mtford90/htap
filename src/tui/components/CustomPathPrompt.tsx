/** @jsxImportSource @opentui/react */

/**
 * The "type a directory" step shared by the two export pickers.
 */

import React from "react";
import { DIM } from "./styles.js";

const PATH_FIELD_WIDTH = 48;

export function CustomPathPrompt({
  onChange,
}: {
  onChange: (path: string) => void;
}): React.ReactNode {
  return (
    <box flexDirection="column" alignItems="center">
      <text>Enter directory path:</text>
      <box marginTop={1} flexDirection="row">
        <text>
          <span fg="cyan">&gt; </span>
        </text>
        <input focused value="" onInput={onChange} width={PATH_FIELD_WIDTH} flexShrink={0} />
      </box>
      <box marginTop={2}>
        <text attributes={DIM}>Enter to save, Escape to go back</text>
      </box>
    </box>
  );
}
