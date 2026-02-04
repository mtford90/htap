/**
 * Left panel: scrollable list of captured requests.
 */

import React from "react";
import { Box, Text } from "ink";
import type { CapturedRequest } from "../../../shared/types.js";
import { RequestListItem } from "./RequestListItem.js";

interface RequestListProps {
  requests: CapturedRequest[];
  selectedIndex: number;
  isActive: boolean;
  width: number;
  height: number;
  showFullUrl?: boolean;
}

export function RequestList({
  requests,
  selectedIndex,
  isActive,
  width,
  height,
  showFullUrl,
}: RequestListProps): React.ReactElement {
  // Calculate visible window (accounting for border and header)
  const visibleHeight = Math.max(1, height - 3); // Border + header row
  const halfWindow = Math.floor(visibleHeight / 2);

  // Calculate scroll offset to keep selection centered
  let scrollOffset = 0;
  if (requests.length > visibleHeight) {
    scrollOffset = Math.max(0, Math.min(selectedIndex - halfWindow, requests.length - visibleHeight));
  }

  const visibleRequests = requests.slice(scrollOffset, scrollOffset + visibleHeight);

  const borderColour = isActive ? "cyan" : "gray";

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="single"
      borderColor={borderColour}
    >
      <Box paddingX={1}>
        <Text bold color={isActive ? "cyan" : "white"}>
          Requests ({requests.length})
        </Text>
        {requests.length > visibleHeight && (
          <Text dimColor>
            {" "}
            [{scrollOffset + 1}-{Math.min(scrollOffset + visibleHeight, requests.length)}]
          </Text>
        )}
      </Box>

      {requests.length === 0 ? (
        <Box paddingX={1} paddingY={1}>
          <Text dimColor>No requests captured yet</Text>
        </Box>
      ) : (
        <Box flexDirection="column" paddingX={1}>
          {visibleRequests.map((request, index) => (
            <RequestListItem
              key={request.id}
              request={request}
              isSelected={scrollOffset + index === selectedIndex}
              width={width - 4} // Account for border and padding
              showFullUrl={showFullUrl}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
