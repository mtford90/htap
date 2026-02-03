/**
 * Display HTTP headers in a formatted view.
 */

import React from "react";
import { Box, Text } from "ink";

interface HeadersViewProps {
  title: string;
  headers: Record<string, string> | undefined;
  maxLines?: number;
  scrollOffset?: number;
}

export function HeadersView({
  title,
  headers,
  maxLines,
  scrollOffset = 0,
}: HeadersViewProps): React.ReactElement {
  const entries = headers ? Object.entries(headers) : [];

  const visibleEntries =
    maxLines !== undefined ? entries.slice(scrollOffset, scrollOffset + maxLines) : entries;

  return (
    <Box flexDirection="column">
      <Text bold color="yellow">
        {title}
      </Text>
      {entries.length === 0 ? (
        <Text dimColor>No headers</Text>
      ) : (
        visibleEntries.map(([name, value]) => (
          <Box key={name}>
            <Text color="cyan">{name}</Text>
            <Text>: </Text>
            <Text>{value}</Text>
          </Box>
        ))
      )}
      {maxLines !== undefined && entries.length > maxLines && (
        <Text dimColor>... and {entries.length - maxLines} more</Text>
      )}
    </Box>
  );
}
