/**
 * Single request row in the request list.
 */

import React from "react";
import { Box, Text } from "ink";
import type { CapturedRequest } from "../../../shared/types.js";
import { formatMethod, formatDuration, truncate } from "../utils/formatters.js";

interface RequestListItemProps {
  request: CapturedRequest;
  isSelected: boolean;
  width: number;
  showFullUrl?: boolean;
}

/**
 * Get colour for HTTP status code.
 */
function getStatusColour(status: number | undefined): string {
  if (status === undefined) {
    return "gray";
  }
  if (status >= 200 && status < 300) {
    return "green";
  }
  if (status >= 300 && status < 400) {
    return "yellow";
  }
  if (status >= 400) {
    return "red";
  }
  return "white";
}

/**
 * Get colour for HTTP method.
 */
function getMethodColour(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "green";
    case "POST":
      return "blue";
    case "PUT":
      return "yellow";
    case "PATCH":
      return "yellow";
    case "DELETE":
      return "red";
    default:
      return "white";
  }
}

export function RequestListItem({
  request,
  isSelected,
  width,
  showFullUrl,
}: RequestListItemProps): React.ReactElement {
  const methodWidth = 7;
  const statusWidth = 4;
  const durationWidth = 8;
  const separatorsWidth = 3; // Spaces between columns

  // Calculate remaining width for path
  const pathWidth = Math.max(10, width - methodWidth - statusWidth - durationWidth - separatorsWidth);
  const displayPath = truncate(showFullUrl ? request.url : request.path, pathWidth);

  const statusText = request.responseStatus?.toString() ?? "...";
  const duration = formatDuration(request.durationMs);

  return (
    <Box>
      {isSelected && <Text color="cyan">❯ </Text>}
      {!isSelected && <Text>  </Text>}
      <Text color={getMethodColour(request.method)}>{formatMethod(request.method)}</Text>
      <Text> </Text>
      <Text color={getStatusColour(request.responseStatus)}>{statusText.padStart(3)}</Text>
      <Text> </Text>
      <Text dimColor={!isSelected}>{displayPath}</Text>
      <Box flexGrow={1} />
      <Text dimColor>{duration.padStart(durationWidth)}</Text>
    </Box>
  );
}
