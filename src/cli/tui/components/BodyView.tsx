/**
 * Display HTTP body with JSON pretty-printing.
 */

import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { formatSize } from "../utils/formatters.js";

interface BodyViewProps {
  title: string;
  body: Buffer | undefined;
  contentType?: string;
  maxLines?: number;
  scrollOffset?: number;
}

/**
 * Attempt to parse and format JSON body.
 */
function formatBody(body: Buffer | undefined, contentType?: string): string[] {
  if (!body || body.length === 0) {
    return ["(empty)"];
  }

  const bodyStr = body.toString("utf-8");

  // Try JSON formatting if content type suggests JSON or body looks like JSON
  const isJson =
    contentType?.includes("application/json") ||
    bodyStr.trimStart().startsWith("{") ||
    bodyStr.trimStart().startsWith("[");

  if (isJson) {
    try {
      const parsed = JSON.parse(bodyStr) as unknown;
      const formatted = JSON.stringify(parsed, null, 2);
      return formatted.split("\n");
    } catch {
      // Not valid JSON, show as-is
    }
  }

  // For non-JSON or invalid JSON, show as-is with line breaks
  return bodyStr.split("\n");
}

export function BodyView({
  title,
  body,
  contentType,
  maxLines,
  scrollOffset = 0,
}: BodyViewProps): React.ReactElement {
  const lines = useMemo(() => formatBody(body, contentType), [body, contentType]);

  const visibleLines =
    maxLines !== undefined ? lines.slice(scrollOffset, scrollOffset + maxLines) : lines;

  const sizeStr = body ? formatSize(body.length) : "-";

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color="yellow">
          {title}
        </Text>
        <Text dimColor> ({sizeStr})</Text>
      </Box>
      {visibleLines.map((line, index) => (
        <Text key={scrollOffset + index} wrap="truncate">
          {line}
        </Text>
      ))}
      {maxLines !== undefined && lines.length > maxLines + scrollOffset && (
        <Text dimColor>... {lines.length - maxLines - scrollOffset} more lines</Text>
      )}
    </Box>
  );
}
