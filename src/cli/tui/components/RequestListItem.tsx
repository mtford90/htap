/**
 * Single request row in the request list.
 */

import React, { useRef, memo } from "react";
import { Box, Text, type DOMElement } from "ink";
import { useOnClick } from "@ink-tools/ink-mouse";
import type { CapturedRequestSummary } from "../../../shared/types.js";
import { formatMethod, formatDuration, truncate } from "../../../tui/utils/formatters.js";
import {
  getInterceptionIndicator,
  getMethodColour,
  getReplayIndicator,
  getStatusColour,
  getStatusIndicator,
  splitByMatch,
} from "../../../tui/utils/row-format.js";

interface RequestListItemProps {
  request: CapturedRequestSummary;
  isSelected: boolean;
  width: number;
  showFullUrl?: boolean;
  onClick?: () => void;
  searchTerm?: string;
}

export const RequestListItem = memo(function RequestListItem({
  request,
  isSelected,
  width,
  showFullUrl,
  onClick,
  searchTerm,
}: RequestListItemProps): React.ReactElement {
  const ref = useRef<DOMElement>(null);

  useOnClick(ref, () => {
    if (onClick) {
      onClick();
    }
  });

  const interceptionWidth = 2; // "M " / "I " / "  "
  const replayWidth = 2; // "R " / "  "
  const methodWidth = 7;
  const statusWidth = 6;
  const durationWidth = 8;
  const separatorsWidth = 3; // Spaces between columns

  // Calculate remaining width for path
  const pathWidth = Math.max(
    10,
    width - interceptionWidth - replayWidth - methodWidth - statusWidth - durationWidth - separatorsWidth
  );
  const displayPath = truncate(showFullUrl ? request.url : request.path, pathWidth);
  const paddedPath = displayPath.padEnd(pathWidth);

  const statusText = request.responseStatus?.toString() ?? "...";
  const statusIndicator = getStatusIndicator(request.responseStatus);
  const duration = formatDuration(request.durationMs);

  const savedChar = request.saved ? "*" : " ";
  const indicator = isSelected ? `❯${savedChar}` : ` ${savedChar}`;
  const indicatorColour = isSelected ? "cyan" : request.saved ? "yellow" : undefined;
  const interception = getInterceptionIndicator(request.interceptionType);
  const replay = getReplayIndicator(request.replayedFromId);

  return (
    <Box ref={ref} width={width}>
      <Text wrap="truncate">
        <Text color={indicatorColour}>{indicator}</Text>
        <Text color={interception.colour}>{interception.text}</Text>
        <Text color={replay.colour}>{replay.text}</Text>
        <Text color={getMethodColour(request.method)}>{formatMethod(request.method)}</Text>
        <Text> </Text>
        <Text color={getStatusColour(request.responseStatus)}>{statusIndicator}{statusText.padStart(3)}</Text>
        <Text> </Text>
        {searchTerm ? (
          <Text dimColor={!isSelected}>
            {splitByMatch(paddedPath, searchTerm).map((seg, i) =>
              seg.isMatch ? (
                <Text key={i} color="yellow" bold>{seg.text}</Text>
              ) : (
                <Text key={i}>{seg.text}</Text>
              ),
            )}
          </Text>
        ) : (
          <Text dimColor={!isSelected}>{paddedPath}</Text>
        )}
        <Text dimColor>{duration.padStart(durationWidth)}</Text>
      </Text>
    </Box>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.request === nextProps.request &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.width === nextProps.width &&
    prevProps.showFullUrl === nextProps.showFullUrl &&
    prevProps.searchTerm === nextProps.searchTerm
  );
});
