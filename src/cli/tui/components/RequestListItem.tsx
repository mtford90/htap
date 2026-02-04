/**
 * Single request row in the request list.
 */

import React, { useRef, useState } from "react";
import { Box, Text, type DOMElement } from "ink";
import { useOnClick, useOnMouseEnter, useOnMouseLeave } from "@ink-tools/ink-mouse";
import type { CapturedRequest } from "../../../shared/types.js";
import { formatMethod, formatDuration, truncate } from "../utils/formatters.js";

interface RequestListItemProps {
  request: CapturedRequest;
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

export function RequestListItem({
  request,
  isSelected,
  width,
  showFullUrl,
  onClick,
}: RequestListItemProps): React.ReactElement {
  const ref = useRef<DOMElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Register mouse event handlers
  useOnClick(ref, () => {
    if (onClick) {
      onClick();
    }
  });
  useOnMouseEnter(ref, () => setIsHovered(true));
  useOnMouseLeave(ref, () => setIsHovered(false));

  // Determine visual state: selected takes precedence, then hovered
  const isHighlighted = isSelected || isHovered;

  const methodWidth = 7;
  const statusWidth = 4;
  const durationWidth = 8;
  const separatorsWidth = 3; // Spaces between columns

  // Calculate remaining width for path
  const pathWidth = Math.max(10, width - methodWidth - statusWidth - durationWidth - separatorsWidth);
  const displayPath = truncate(showFullUrl ? request.url : request.path, pathWidth);

  const statusText = request.responseStatus?.toString() ?? "...";
  const duration = formatDuration(request.durationMs);

  // Indicator: selected shows ❯, hovered shows ›, otherwise empty
  let indicator = "  ";
  let indicatorColour: string | undefined;
  if (isSelected) {
    indicator = "❯ ";
    indicatorColour = "cyan";
  } else if (isHovered) {
    indicator = "› ";
    indicatorColour = "gray";
  }

  return (
    <Box ref={ref}>
      <Text color={indicatorColour}>{indicator}</Text>
      <Text color={getMethodColour(request.method)}>{formatMethod(request.method)}</Text>
      <Text> </Text>
      <Text color={getStatusColour(request.responseStatus)}>{statusText.padStart(3)}</Text>
      <Text> </Text>
      <Text dimColor={!isHighlighted}>{displayPath}</Text>
      <Box flexGrow={1} />
      <Text dimColor>{duration.padStart(durationWidth)}</Text>
    </Box>
  );
}
