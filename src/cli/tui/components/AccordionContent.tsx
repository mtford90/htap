/**
 * Content components for accordion sections: headers, body, binary, truncated.
 */

import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { formatSize } from "../utils/formatters.js";
import { isBinaryContent, getBinaryTypeDescription } from "../utils/binary.js";

/**
 * Display request/response headers as key-value pairs.
 */
export function HeadersContent({
  headers,
  maxLines,
}: {
  headers: Record<string, string> | undefined;
  maxLines: number;
}): React.ReactElement {
  const entries = headers ? Object.entries(headers) : [];

  if (entries.length === 0) {
    return <Text dimColor>No headers</Text>;
  }

  const visibleEntries = entries.slice(0, maxLines);
  const remaining = entries.length - visibleEntries.length;

  return (
    <Box flexDirection="column">
      {visibleEntries.map(([name, value]) => (
        <Box key={name}>
          <Text color="cyan">{name}</Text>
          <Text>: </Text>
          <Text wrap="truncate">{value}</Text>
        </Box>
      ))}
      {remaining > 0 && <Text dimColor>... and {remaining} more</Text>}
    </Box>
  );
}

/**
 * Display a message for bodies that were too large to capture.
 */
export function TruncatedBodyContent({
  contentLength,
}: {
  contentLength: string | undefined;
}): React.ReactElement {
  const size = contentLength ? formatSize(parseInt(contentLength, 10)) : "unknown size";
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center">
      <Text dimColor>Body too large to capture ({size})</Text>
      <Text dimColor>Content delivered to client</Text>
    </Box>
  );
}

/**
 * Display a message for binary content with save prompt.
 */
function BinaryBodyContent({
  body,
  contentType,
}: {
  body: Buffer;
  contentType: string | undefined;
}): React.ReactElement {
  const description = getBinaryTypeDescription(contentType);
  const size = formatSize(body.length);
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center">
      <Text dimColor>
        {description} content ({size})
      </Text>
      <Text color="cyan">Press 's' to save</Text>
    </Box>
  );
}

/**
 * Display body content with JSON pretty-printing and binary detection.
 */
export function BodyContent({
  body,
  contentType,
  maxLines,
  isTruncated,
  contentLength,
}: {
  body: Buffer | undefined;
  contentType?: string;
  maxLines: number;
  isTruncated?: boolean;
  contentLength?: string;
}): React.ReactElement {
  // All hooks must be called before any conditional returns
  const binaryCheck = useMemo(
    () => isBinaryContent(body, contentType),
    [body, contentType]
  );

  // Compute text lines (only used for text content, but must be called unconditionally)
  const lines = useMemo(() => {
    if (!body || body.length === 0) {
      return [];
    }

    const bodyStr = body.toString("utf-8");

    // Try JSON formatting
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
        // Not valid JSON
      }
    }

    return bodyStr.split("\n");
  }, [body, contentType]);

  // Handle truncated bodies
  if (isTruncated) {
    return <TruncatedBodyContent contentLength={contentLength} />;
  }

  // Handle empty bodies
  if (!body || body.length === 0) {
    return <Text dimColor>(empty)</Text>;
  }

  // Handle binary content
  if (binaryCheck.isBinary) {
    return <BinaryBodyContent body={body} contentType={contentType} />;
  }

  // Text content
  const visibleLines = lines.slice(0, maxLines);
  const remaining = lines.length - visibleLines.length;

  return (
    <Box flexDirection="column">
      {visibleLines.map((line, index) => (
        <Text key={index} wrap="truncate">
          {line}
        </Text>
      ))}
      {remaining > 0 && <Text dimColor>... {remaining} more lines</Text>}
    </Box>
  );
}
