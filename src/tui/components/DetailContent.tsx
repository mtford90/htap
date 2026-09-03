/** @jsxImportSource @opentui/react */

/**
 * Section contents for the detail pane: headers, bodies, and the placeholders
 * for bodies that were truncated or are binary.
 */

import React from "react";
import { formatSize } from "../utils/formatters.js";
import { getBinaryTypeDescription, isBinaryContent } from "../utils/binary.js";
import { isJsonContent } from "../utils/content-type.js";
import { highlightCode } from "../utils/syntax-highlight.js";
import { parseAnsiLines, type AnsiSegment } from "../utils/ansi-spans.js";
import { attributes, DIM } from "./styles.js";

/** Only the first 10 KB is prepared for display; exports still use the whole body. */
const BODY_PREVIEW_LIMIT = 10 * 1024;

export function HeadersContent({
  headers,
  maxLines,
}: {
  headers: Record<string, string> | undefined;
  maxLines: number;
}): React.ReactNode {
  const entries = headers ? Object.entries(headers) : [];
  if (entries.length === 0) {
    return <text attributes={DIM}>No headers</text>;
  }

  const visibleEntries = entries.slice(0, maxLines);
  const remaining = entries.length - visibleEntries.length;

  return (
    <box flexDirection="column">
      {visibleEntries.map(([name, value]) => (
        <text key={name} wrapMode="none">
          <span fg="cyan">{name}</span>
          <span>: </span>
          <span>{value}</span>
        </text>
      ))}
      {remaining > 0 && <text attributes={DIM}>{`... and ${remaining} more`}</text>}
    </box>
  );
}

export function TruncatedBodyContent({
  contentLength,
}: {
  contentLength: string | undefined;
}): React.ReactNode {
  const size = contentLength ? formatSize(parseInt(contentLength, 10)) : "unknown size";
  return (
    <box flexDirection="column" alignItems="center" justifyContent="center">
      <text attributes={DIM}>{`Body too large to capture (${size})`}</text>
      <text attributes={DIM}>Content delivered to client</text>
    </box>
  );
}

function BinaryBodyContent({
  body,
  contentType,
}: {
  body: Buffer;
  contentType: string | undefined;
}): React.ReactNode {
  return (
    <box flexDirection="column" alignItems="center" justifyContent="center">
      <text attributes={DIM}>
        {`${getBinaryTypeDescription(contentType)} content (${formatSize(body.length)})`}
      </text>
      <text fg="cyan">Press &apos;s&apos; to export</text>
    </box>
  );
}

/** Renders one highlighted line as spans, since OpenTUI does not read escapes. */
export const HighlightedLine = React.memo(function HighlightedLine({
  segments,
}: {
  segments: AnsiSegment[];
}): React.ReactNode {
  if (segments.length === 0) {
    return <text wrapMode="none"> </text>;
  }
  return (
    <text wrapMode="none">
      {segments.map((segment, index) => (
        <span key={index} fg={segment.fg} attributes={attributes(segment)}>
          {segment.text}
        </span>
      ))}
    </text>
  );
});

/**
 * Turns a body into display lines: pretty-printed when it is JSON, syntax
 * highlighted when the content type is known, and marked when it was cut short.
 */
export const bodyDisplayLines = (
  body: Buffer,
  contentType: string | undefined
): AnsiSegment[][] => {
  const truncated = body.length > BODY_PREVIEW_LIMIT;
  let text = (truncated ? body.subarray(0, BODY_PREVIEW_LIMIT) : body).toString("utf-8");

  if (isJsonContent(contentType) && !truncated) {
    try {
      text = JSON.stringify(JSON.parse(text) as unknown, null, 2);
    } catch {
      // Not valid JSON after all; show it as it arrived.
    }
  }

  const lines = parseAnsiLines(highlightCode(text, contentType));
  if (truncated) {
    lines.push([{ text: `... truncated (${formatSize(body.length)} total)` }]);
  }
  return lines;
};

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
}): React.ReactNode {
  if (isTruncated) {
    return <TruncatedBodyContent contentLength={contentLength} />;
  }
  if (!body || body.length === 0) {
    return <text attributes={DIM}>(empty)</text>;
  }
  if (isBinaryContent(body, contentType).isBinary) {
    return <BinaryBodyContent body={body} contentType={contentType} />;
  }

  const lines = bodyDisplayLines(body, contentType);
  const visibleLines = lines.slice(0, maxLines);
  const remaining = lines.length - visibleLines.length;

  return (
    <box flexDirection="column">
      {visibleLines.map((segments, index) => (
        <HighlightedLine key={index} segments={segments} />
      ))}
      {remaining > 0 && <text attributes={DIM}>{`... ${remaining} more lines`}</text>}
    </box>
  );
}
