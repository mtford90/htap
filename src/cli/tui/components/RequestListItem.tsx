/**
 * Single request row in the request list.
 */

import React, { useRef, memo } from "react";
import { Box, Text, type DOMElement } from "ink";
import { useOnClick } from "@ink-tools/ink-mouse";
import type { CapturedRequestSummary } from "../../../shared/types.js";
import { formatMethod, formatDuration, truncate } from "../utils/formatters.js";

interface RequestListItemProps {
  request: CapturedRequestSummary;
  isSelected: boolean;
  width: number;
  showFullUrl?: boolean;
  onClick?: () => void;
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

export const RequestListItem = memo(function RequestListItem({
  request,
  isSelected,
  width,
  showFullUrl,
  onClick,
}: RequestListItemProps): React.ReactElement {
  const ref = useRef<DOMElement>(null);

  useOnClick(ref, () => {
    if (onClick) {
      onClick();
    }
  });

  const methodWidth = 7;
  const statusWidth = 4;
  const durationWidth = 8;
  const separatorsWidth = 3; // Spaces between columns

  // Calculate remaining width for path
  const pathWidth = Math.max(10, width - methodWidth - statusWidth - durationWidth - separatorsWidth);
  const displayPath = truncate(showFullUrl ? request.url : request.path, pathWidth);

  const statusText = request.responseStatus?.toString() ?? "...";
  const duration = formatDuration(request.durationMs);

  const indicator = isSelected ? "❯ " : "  ";
  const indicatorColour = isSelected ? "cyan" : undefined;

  return (
    <Box ref={ref}>
      <Text color={indicatorColour}>{indicator}</Text>
      <Text color={getMethodColour(request.method)}>{formatMethod(request.method)}</Text>
      <Text> </Text>
      <Text color={getStatusColour(request.responseStatus)}>{statusText.padStart(3)}</Text>
      <Text> </Text>
      <Text dimColor={!isSelected}>{displayPath}</Text>
      <Box flexGrow={1} />
      <Text dimColor>{duration.padStart(durationWidth)}</Text>
    </Box>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.request === nextProps.request &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.width === nextProps.width &&
    prevProps.showFullUrl === nextProps.showFullUrl
  );
});
