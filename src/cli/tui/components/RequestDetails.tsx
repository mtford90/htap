/**
 * Right panel: detailed view of the selected request.
 */

import React, { forwardRef } from "react";
import { Box, Text, type DOMElement } from "ink";
import type { CapturedRequest } from "../../../shared/types.js";
import { HeadersView } from "./HeadersView.js";
import { BodyView } from "./BodyView.js";
import { formatRelativeTime, formatDuration } from "../utils/formatters.js";
import { Panel } from "./Panel.js";

interface RequestDetailsProps {
  request: CapturedRequest | undefined;
  isActive: boolean;
  isHovered?: boolean;
  width: number;
  height: number;
}

export const RequestDetails = forwardRef<DOMElement, RequestDetailsProps>(function RequestDetails(
  { request, isActive, isHovered, width, height },
  ref,
) {
  if (!request) {
    return (
      <Panel
        ref={ref}
        title="[2] Details"
        isActive={isActive}
        isHovered={isHovered}
        width={width}
        height={height}
      >
        <Box flexGrow={1} alignItems="center" justifyContent="center">
          <Text dimColor>Select a request to view details</Text>
        </Box>
      </Panel>
    );
  }

  // Calculate how much space we have for each section
  const headerHeight = 6; // URL line + timing + separators
  const availableHeight = Math.max(8, height - headerHeight);
  const sectionHeight = Math.floor(availableHeight / 4);

  const reqContentType = request.requestHeaders["content-type"];
  const resContentType = request.responseHeaders?.["content-type"];

  return (
    <Panel
      ref={ref}
      title="[2] Details"
      isActive={isActive}
      isHovered={isHovered}
      width={width}
      height={height}
    >
      {/* URL and basic info */}
      <Box marginBottom={1}>
        <Text color="green" bold>
          {request.method}
        </Text>
        <Text> </Text>
        <Text>{request.url}</Text>
      </Box>

      {/* Timing info */}
      <Box marginBottom={1}>
        <Text dimColor>Status: </Text>
        <Text color={request.responseStatus && request.responseStatus < 400 ? "green" : "red"}>
          {request.responseStatus ?? "pending"}
        </Text>
        <Text dimColor> │ Duration: </Text>
        <Text>{formatDuration(request.durationMs)}</Text>
        <Text dimColor> │ </Text>
        <Text dimColor>{formatRelativeTime(request.timestamp)}</Text>
      </Box>

      {/* Request headers */}
      <Box marginBottom={1}>
        <HeadersView title="Request Headers" headers={request.requestHeaders} maxLines={sectionHeight} />
      </Box>

      {/* Request body */}
      {request.requestBody && request.requestBody.length > 0 && (
        <Box marginBottom={1}>
          <BodyView
            title="Request Body"
            body={request.requestBody}
            contentType={reqContentType}
            maxLines={sectionHeight}
          />
        </Box>
      )}

      {/* Response headers */}
      {request.responseHeaders && (
        <Box marginBottom={1}>
          <HeadersView
            title="Response Headers"
            headers={request.responseHeaders}
            maxLines={sectionHeight}
          />
        </Box>
      )}

      {/* Response body */}
      {request.responseBody && request.responseBody.length > 0 && (
        <Box marginBottom={1}>
          <BodyView
            title="Response Body"
            body={request.responseBody}
            contentType={resContentType}
            maxLines={sectionHeight}
          />
        </Box>
      )}
    </Panel>
  );
});
