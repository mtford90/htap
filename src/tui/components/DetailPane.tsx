/** @jsxImportSource @opentui/react */

/**
 * Right panel: four collapsible sections describing the selected request,
 * drawn as one panel with connected borders.
 */

import React from "react";
import type { CapturedRequest } from "../../shared/types.js";
import {
  breakUrl,
  formatMethod,
  formatSize,
  getStatusText,
  shortContentType,
} from "../utils/formatters.js";
import {
  SECTION_COUNT,
  SECTION_REQUEST,
  SECTION_REQUEST_BODY,
  SECTION_RESPONSE,
  SECTION_RESPONSE_BODY,
} from "../store/types.js";
import { BodyContent, HeadersContent, TruncatedBodyContent } from "./DetailContent.js";
import { buildBottomBorder, buildDividerLine } from "./panel-chrome.js";
import { attributes, BOLD, DIM } from "./styles.js";

const SHORT_REQUEST_ID_LENGTH = 7;
const MIN_EXPANDED_HEIGHT = 3;

/**
 * Collapsed sections take one row each; the expanded ones share what is left
 * after reserving a row for the bottom border.
 */
export const calculateHeights = (
  totalHeight: number,
  expandedSections: ReadonlySet<number>,
  sectionCount: number
): number[] => {
  const expandedCount = expandedSections.size;
  if (expandedCount === 0) {
    return Array.from({ length: sectionCount }, () => 1);
  }

  const remainingHeight = totalHeight - 1 - (sectionCount - expandedCount);
  const expandedHeight = Math.max(
    MIN_EXPANDED_HEIGHT,
    Math.floor(remainingHeight / expandedCount)
  );

  return Array.from({ length: sectionCount }, (_, index) =>
    expandedSections.has(index) ? expandedHeight : 1
  );
};

interface SectionProps {
  title: string;
  rightValue?: string;
  isExpanded: boolean;
  isFocused: boolean;
  height: number;
  width: number;
  isFirst: boolean;
  borderColour: string;
  children?: React.ReactNode;
}

function Section({
  title,
  rightValue,
  isExpanded,
  isFocused,
  height,
  width,
  isFirst,
  borderColour,
  children,
}: SectionProps): React.ReactNode {
  const dividerLine = buildDividerLine(title, isExpanded, isFocused, width, isFirst, rightValue);
  const divider = (
    <text height={1} wrapMode="none" fg={borderColour} attributes={attributes({ bold: isFocused })}>
      {dividerLine}
    </text>
  );

  if (!isExpanded) {
    return divider;
  }

  return (
    <box flexDirection="column" width={width} height={height}>
      {divider}
      <box
        flexDirection="column"
        width={width}
        height={height - 1}
        border={["left", "right"]}
        borderStyle="single"
        borderColor={borderColour}
        paddingLeft={1}
        overflow="hidden"
      >
        {children}
      </box>
    </box>
  );
}

export interface DetailPaneProps {
  request: CapturedRequest | null;
  width: number;
  height: number;
  isActive: boolean;
  focusedSection: number;
  expandedSections: ReadonlySet<number>;
  onActivate: () => void;
  onHoverChange: (hovered: boolean) => void;
}

export function DetailPane({
  request,
  width,
  height,
  isActive,
  focusedSection,
  expandedSections,
  onActivate,
  onHoverChange,
}: DetailPaneProps): React.ReactNode {
  if (!request) {
    return (
      <box
        flexDirection="column"
        width={width}
        height={height}
        alignItems="center"
        justifyContent="center"
      >
        <text attributes={DIM}>Select a request to view details</text>
      </box>
    );
  }

  const heights = calculateHeights(height, expandedSections, SECTION_COUNT);
  const contentLines = (index: number): number => Math.max(1, (heights[index] ?? 1) - 3);
  const borderColour = (index: number): string => {
    if (!isActive) {
      return "gray";
    }
    return focusedSection === index ? "cyan" : "white";
  };

  const requestContentType = request.requestHeaders["content-type"];
  const responseContentType = request.responseHeaders?.["content-type"];
  const requestBodySize = request.requestBody?.length;
  const responseBodySize = request.responseBody?.length;

  const sizeSuffix = (size: number | undefined): string => (size ? ` ${formatSize(size)}` : "");

  return (
    <box
      flexDirection="column"
      width={width}
      height={height}
      onMouseDown={onActivate}
      onMouseOver={() => onHoverChange(true)}
      onMouseOut={() => onHoverChange(false)}
    >
      <Section
        title="[2] Request"
        rightValue={requestContentType ? shortContentType(requestContentType) : undefined}
        isExpanded={expandedSections.has(SECTION_REQUEST)}
        isFocused={isActive && focusedSection === SECTION_REQUEST}
        height={heights[SECTION_REQUEST] ?? 1}
        width={width}
        isFirst
        borderColour={borderColour(SECTION_REQUEST)}
      >
        <box flexDirection="column">
          {request.interceptedBy && (
            <text marginBottom={1} wrapMode="none">
              <span fg="magenta" attributes={BOLD}>
                Intercepted by:{" "}
              </span>
              <span>{request.interceptedBy}</span>
              {request.interceptionType ? (
                <span attributes={DIM}>{` (${request.interceptionType})`}</span>
              ) : null}
            </text>
          )}
          {request.replayedFromId && (
            <text marginBottom={1} wrapMode="none">
              <span fg="yellow" attributes={BOLD}>
                Replayed from:{" "}
              </span>
              <span>{request.replayedFromId.slice(0, SHORT_REQUEST_ID_LENGTH)}</span>
              {request.replayInitiator ? (
                <span attributes={DIM}>{` (${request.replayInitiator})`}</span>
              ) : null}
            </text>
          )}
          {request.source && request.source !== "daemon" && (
            <text marginBottom={1} wrapMode="none">
              <span fg="blue" attributes={BOLD}>
                Source:{" "}
              </span>
              <span>{request.source}</span>
            </text>
          )}
          <text marginBottom={1} wrapMode="none">
            <span fg="green" attributes={BOLD}>
              {formatMethod(request.method).padEnd(8)}
            </span>
            <span>{breakUrl(request.url)}</span>
          </text>
          <HeadersContent
            headers={request.requestHeaders}
            maxLines={contentLines(SECTION_REQUEST) - 2}
          />
        </box>
      </Section>

      <Section
        title="[3] Request Body"
        rightValue={
          requestContentType || requestBodySize
            ? `${shortContentType(requestContentType)}${sizeSuffix(requestBodySize)}`
            : undefined
        }
        isExpanded={expandedSections.has(SECTION_REQUEST_BODY)}
        isFocused={isActive && focusedSection === SECTION_REQUEST_BODY}
        height={heights[SECTION_REQUEST_BODY] ?? 1}
        width={width}
        isFirst={false}
        borderColour={borderColour(SECTION_REQUEST_BODY)}
      >
        {request.requestBody && request.requestBody.length > 0 ? (
          <BodyContent
            body={request.requestBody}
            contentType={requestContentType}
            maxLines={contentLines(SECTION_REQUEST_BODY)}
            isTruncated={request.requestBodyTruncated}
            contentLength={request.requestHeaders["content-length"]}
          />
        ) : request.requestBodyTruncated ? (
          <TruncatedBodyContent contentLength={request.requestHeaders["content-length"]} />
        ) : (
          <text attributes={DIM}>(no body)</text>
        )}
      </Section>

      <Section
        title="[4] Response"
        rightValue={
          request.responseStatus !== undefined
            ? `${request.responseStatus} ${getStatusText(request.responseStatus)}`
            : undefined
        }
        isExpanded={expandedSections.has(SECTION_RESPONSE)}
        isFocused={isActive && focusedSection === SECTION_RESPONSE}
        height={heights[SECTION_RESPONSE] ?? 1}
        width={width}
        isFirst={false}
        borderColour={borderColour(SECTION_RESPONSE)}
      >
        {request.responseHeaders ? (
          <HeadersContent
            headers={request.responseHeaders}
            maxLines={contentLines(SECTION_RESPONSE)}
          />
        ) : (
          <text attributes={DIM}>(pending response)</text>
        )}
      </Section>

      <Section
        title="[5] Response Body"
        rightValue={
          responseContentType || responseBodySize
            ? `${shortContentType(responseContentType)}${sizeSuffix(responseBodySize)}`
            : undefined
        }
        isExpanded={expandedSections.has(SECTION_RESPONSE_BODY)}
        isFocused={isActive && focusedSection === SECTION_RESPONSE_BODY}
        height={heights[SECTION_RESPONSE_BODY] ?? 1}
        width={width}
        isFirst={false}
        borderColour={borderColour(SECTION_RESPONSE_BODY)}
      >
        {request.responseBody && request.responseBody.length > 0 ? (
          <BodyContent
            body={request.responseBody}
            contentType={responseContentType}
            maxLines={contentLines(SECTION_RESPONSE_BODY)}
            isTruncated={request.responseBodyTruncated}
            contentLength={request.responseHeaders?.["content-length"]}
          />
        ) : request.responseBodyTruncated ? (
          <TruncatedBodyContent contentLength={request.responseHeaders?.["content-length"]} />
        ) : (
          <text attributes={DIM}>(no body)</text>
        )}
      </Section>

      <text height={1} fg={isActive ? "white" : "gray"}>
        {buildBottomBorder(width)}
      </text>
    </box>
  );
}
