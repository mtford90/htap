/** @jsxImportSource @opentui/react */

/**
 * Section contents for the detail pane: headers, bodies, and the placeholders
 * for bodies that were truncated or are binary.
 */

import React from "react";
import { formatSize } from "../utils/formatters.js";
import { getBinaryTypeDescription, isBinaryContent } from "../utils/binary.js";
import { isJsonContent } from "../utils/content-type.js";
import {
  getHighlighterVersion,
  highlightCode,
  subscribeToHighlighter,
} from "../utils/syntax-highlight.js";
import { parseAnsiLines, type AnsiSegment } from "../utils/ansi-spans.js";
import { attributes, DIM } from "./styles.js";

/** Only the first 10 KB is prepared for display; exports still use the whole body. */
const BODY_PREVIEW_LIMIT = 10 * 1024;

/**
 * Columns kept per displayed line before highlighting. Lines are drawn with
 * `wrapMode="none"` in a pane no wider than the terminal, so anything past this
 * is clipped by the renderer anyway, and a body that arrives as one enormous
 * line costs no more than a short one.
 */
const BODY_LINE_COLUMN_LIMIT = 512;

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

/** Display lines, plus the line count of the body they were cut from. */
export interface BodyDisplay {
  lines: AnsiSegment[][];
  totalLines: number;
}

/**
 * Turns a body into display lines: pretty-printed when it is JSON, syntax
 * highlighted when the content type is known, and marked when it was cut short.
 *
 * Highlighting costs grow faster than the text it is given, so only the lines
 * the pane can show are highlighted, clipped to the columns it can draw; the
 * rest of the body is counted, not coloured.
 */
export const bodyDisplayLines = (
  body: Buffer,
  contentType: string | undefined,
  maxLines: number
): BodyDisplay => {
  const truncated = body.length > BODY_PREVIEW_LIMIT;
  let text = (truncated ? body.subarray(0, BODY_PREVIEW_LIMIT) : body).toString("utf-8");

  if (isJsonContent(contentType) && !truncated) {
    try {
      text = JSON.stringify(JSON.parse(text) as unknown, null, 2);
    } catch {
      // Not valid JSON after all; show it as it arrived.
    }
  }

  const allLines = text.split("\n");
  const shown = allLines
    .slice(0, maxLines)
    .map((line) => line.slice(0, BODY_LINE_COLUMN_LIMIT))
    .join("\n");

  const lines = parseAnsiLines(highlightCode(shown, contentType));
  if (truncated) {
    lines.push([{ text: `... truncated (${formatSize(body.length)} total)` }]);
  }
  return { lines, totalLines: truncated ? allLines.length + 1 : allLines.length };
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

  return <HighlightedBody body={body} contentType={contentType} maxLines={maxLines} />;
}

/**
 * Highlighting is expensive, so it is keyed on the body and content type and
 * survives re-renders driven by hover, focus or the status message.
 */
function HighlightedBody({
  body,
  contentType,
  maxLines,
}: {
  body: Buffer;
  contentType?: string;
  maxLines: number;
}): React.ReactNode {
  // The highlighter loads after the first frame, so the memo has to be
  // invalidated when it lands or the body drawn at startup stays plain.
  const highlighterVersion = React.useSyncExternalStore(
    subscribeToHighlighter,
    getHighlighterVersion
  );
  const { lines, totalLines } = React.useMemo(
    () => bodyDisplayLines(body, contentType, maxLines),
    [body, contentType, maxLines, highlighterVersion]
  );
  const visibleLines = lines.slice(0, maxLines);
  const remaining = totalLines - visibleLines.length;

  return (
    <box flexDirection="column">
      {visibleLines.map((segments, index) => (
        <HighlightedLine key={index} segments={segments} />
      ))}
      {remaining > 0 && <text attributes={DIM}>{`... ${remaining} more lines`}</text>}
    </box>
  );
}
