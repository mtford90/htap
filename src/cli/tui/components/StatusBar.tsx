/**
 * Status bar showing keybinding hints at the bottom of the TUI.
 */

import React from "react";
import { Box, Text } from "ink";

interface KeyHint {
  key: string;
  action: string;
}

const KEY_HINTS: KeyHint[] = [
  { key: "j/k", action: "nav" },
  { key: "Tab", action: "panel" },
  { key: "1-5", action: "section" },
  { key: "Enter", action: "expand" },
  { key: "c", action: "curl" },
  { key: "h", action: "HAR" },
  { key: "s", action: "save" },
  { key: "u", action: "URL" },
  { key: "q", action: "quit" },
];

interface StatusBarProps {
  message?: string;
}

export function StatusBar({ message }: StatusBarProps): React.ReactElement {
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
      ) : (
        KEY_HINTS.map((hint, index) => (
          <React.Fragment key={hint.key}>
            <Text color="cyan" bold>
              {hint.key}
            </Text>
            <Text dimColor> {hint.action}</Text>
            {index < KEY_HINTS.length - 1 && <Text dimColor> │ </Text>}
          </React.Fragment>
        ))
      )}
    </Box>
  );
}
