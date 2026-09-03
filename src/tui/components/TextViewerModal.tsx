/** @jsxImportSource @opentui/react */

/**
 * Full-screen pager for a text body, with line numbers, syntax highlighting
 * and less-style search.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKeyboard } from "@opentui/react";
import { highlightCode } from "../utils/syntax-highlight.js";
import { parseAnsiLines, type AnsiSegment } from "../utils/ansi-spans.js";
import { formatSize } from "../utils/formatters.js";
import { copyToClipboard } from "../utils/clipboard.js";
import { Hints, type HintItem } from "./Hints.js";
import { buildBottomBorder, buildDivider, buildModalHeader } from "./panel-chrome.js";
import { attributes, DIM } from "./styles.js";

const TEXT_VIEWER_HINTS: HintItem[] = [
  { key: "j/k", action: "nav" },
  { key: "^f/^b", action: "page" },
  { key: "g/G", action: "top/bottom" },
  { key: "/", action: "search" },
  { key: "n/N", action: "match" },
  { key: "y", action: "copy" },
  { key: "q/Esc", action: "close" },
];

const STATUS_MESSAGE_TIMEOUT_MS = 3000;
/** Title, info row and divider. */
const HEADER_ROWS = 3;
/** Divider, hint bar and bottom border. */
const FOOTER_ROWS = 3;

const TextLine = React.memo(function TextLine({
  lineNumber,
  lineNumberWidth,
  segments,
  isMatch,
  isCurrentMatch,
}: {
  lineNumber: number;
  lineNumberWidth: number;
  segments: AnsiSegment[];
  isMatch: boolean;
  isCurrentMatch: boolean;
}): React.ReactNode {
  return (
    <text wrapMode="none">
      <span
        fg={isMatch || isCurrentMatch ? "yellow" : undefined}
        attributes={attributes({ bold: isCurrentMatch, dim: !isMatch && !isCurrentMatch })}
      >
        {String(lineNumber).padStart(lineNumberWidth, " ")}
      </span>
      <span attributes={DIM}> │ </span>
      {segments.length === 0
        ? [<span key="blank"> </span>]
        : segments.map((segment, index) => (
            <span key={index} fg={segment.fg} attributes={attributes(segment)}>
              {segment.text}
            </span>
          ))}
    </text>
  );
});

export interface TextViewerModalProps {
  text: string;
  title: string;
  contentType: string;
  bodySize: number;
  width: number;
  height: number;
  onClose: () => void;
  onStatus?: (message: string) => void;
}

export function TextViewerModal({
  text,
  title,
  contentType,
  bodySize,
  width,
  height,
  onClose,
  onStatus,
}: TextViewerModalProps): React.ReactNode {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [searchMode, setSearchMode] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | undefined>();

  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(
    () => () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    },
    []
  );

  const showLocalStatus = useCallback((message: string) => {
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    setStatusMessage(message);
    statusTimeoutRef.current = setTimeout(
      () => setStatusMessage(undefined),
      STATUS_MESSAGE_TIMEOUT_MS
    );
  }, []);

  const lines = useMemo(
    () => parseAnsiLines(highlightCode(text, contentType)),
    [text, contentType]
  );
  const totalLines = lines.length;
  const lineNumberWidth = String(totalLines).length;
  const availableHeight = height - HEADER_ROWS - FOOTER_ROWS;
  const maxScrollOffset = Math.max(0, totalLines - availableHeight);

  /** Matching is done against the raw text so escapes cannot mask a hit. */
  const matchLineIndices = useMemo(() => {
    if (!searchText) {
      return [];
    }
    const needle = searchText.toLowerCase();
    return text
      .split("\n")
      .reduce<number[]>((indices, line, index) => {
        if (line.toLowerCase().includes(needle)) {
          indices.push(index);
        }
        return indices;
      }, []);
  }, [text, searchText]);

  useEffect(() => {
    if (matchLineIndices.length > 0 && currentMatchIndex >= matchLineIndices.length) {
      setCurrentMatchIndex(0);
    }
  }, [matchLineIndices.length, currentMatchIndex]);

  const scrollToMatch = useCallback(
    (matchIndex: number) => {
      const lineIndex = matchLineIndices[matchIndex];
      if (lineIndex === undefined) {
        return;
      }
      const centred = Math.max(0, lineIndex - Math.floor(availableHeight / 2));
      setScrollOffset(Math.min(centred, maxScrollOffset));
    },
    [matchLineIndices, availableHeight, maxScrollOffset]
  );

  useKeyboard((key) => {
    key.stopPropagation();

    if (searchMode) {
      if (key.name === "escape") {
        setSearchMode(false);
        setSearchText("");
        setCurrentMatchIndex(0);
      } else if (key.name === "return") {
        setSearchMode(false);
        if (matchLineIndices.length > 0) {
          setCurrentMatchIndex(0);
          scrollToMatch(0);
        }
      } else if (key.name === "backspace" || key.name === "delete") {
        setSearchText((previous) => previous.slice(0, -1));
      } else if (key.sequence.length === 1 && !key.ctrl && !key.meta) {
        setSearchText((previous) => previous + key.sequence);
      }
      return;
    }

    if (key.name === "escape" || key.sequence === "q") {
      onClose();
      return;
    }

    const clamp = (value: number): number => Math.min(Math.max(value, 0), maxScrollOffset);
    const halfPage = Math.floor(availableHeight / 2);

    if (key.sequence === "j" || key.name === "down") {
      setScrollOffset((previous) => clamp(previous + 1));
    } else if (key.sequence === "k" || key.name === "up") {
      setScrollOffset((previous) => clamp(previous - 1));
    } else if (key.ctrl && key.name === "d") {
      setScrollOffset((previous) => clamp(previous + halfPage));
    } else if (key.ctrl && key.name === "u") {
      setScrollOffset((previous) => clamp(previous - halfPage));
    } else if ((key.ctrl && key.name === "f") || key.name === "space") {
      setScrollOffset((previous) => clamp(previous + availableHeight));
    } else if (key.ctrl && key.name === "b") {
      setScrollOffset((previous) => clamp(previous - availableHeight));
    } else if (key.sequence === "g") {
      setScrollOffset(0);
    } else if (key.sequence === "G") {
      setScrollOffset(maxScrollOffset);
    } else if (key.sequence === "/") {
      setSearchMode(true);
      setSearchText("");
      setCurrentMatchIndex(0);
    } else if ((key.sequence === "n" || key.sequence === "N") && matchLineIndices.length > 0) {
      const step = key.sequence === "n" ? 1 : -1;
      const next =
        (currentMatchIndex + step + matchLineIndices.length) % matchLineIndices.length;
      setCurrentMatchIndex(next);
      scrollToMatch(next);
    } else if (key.sequence === "y") {
      void copyToClipboard(text).then(
        () => {
          showLocalStatus("Copied to clipboard");
          onStatus?.("Copied to clipboard");
        },
        () => {
          showLocalStatus("Failed to copy to clipboard");
          onStatus?.("Failed to copy to clipboard");
        }
      );
    }
  });

  const shortContentType = contentType.split(";")[0]?.trim() ?? "";
  const headerBorder = buildModalHeader(
    title,
    width,
    ` ${shortContentType} ${formatSize(bodySize)} `
  );
  const divider = buildDivider(width);
  const visibleSlice = lines.slice(scrollOffset, scrollOffset + availableHeight);
  const matchLineSet = useMemo(() => new Set(matchLineIndices), [matchLineIndices]);
  const currentMatchLine = matchLineIndices[currentMatchIndex];

  return (
    <box flexDirection="column" width={width} height={height}>
      <text fg="cyan">{headerBorder}</text>

      <box height={1} flexShrink={0} paddingLeft={1} paddingRight={1}>
        {searchMode ? (
          <text wrapMode="none">
            <span fg="yellow">search: </span>
            <span>{searchText}</span>
            <span fg="gray">█</span>
          </text>
        ) : (
          <text wrapMode="none" attributes={DIM}>
            {matchLineIndices.length > 0
              ? `Line ${scrollOffset + 1}/${totalLines} | ${matchLineIndices.length} match${matchLineIndices.length === 1 ? "" : "es"} (${currentMatchIndex + 1}/${matchLineIndices.length})`
              : `Line ${scrollOffset + 1}/${totalLines}`}
          </text>
        )}
      </box>

      <text fg="cyan">{divider}</text>

      <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingRight={1}>
        {visibleSlice.map((segments, index) => {
          const lineIndex = scrollOffset + index;
          return (
            <TextLine
              key={lineIndex}
              lineNumber={lineIndex + 1}
              lineNumberWidth={lineNumberWidth}
              segments={segments}
              isMatch={matchLineSet.has(lineIndex)}
              isCurrentMatch={lineIndex === currentMatchLine}
            />
          );
        })}
      </box>

      <text fg="cyan">{divider}</text>
      <box height={1} flexShrink={0} paddingLeft={1} paddingRight={1}>
        {statusMessage ? (
          <text wrapMode="none" fg="green">
            {statusMessage}
          </text>
        ) : (
          <Hints hints={TEXT_VIEWER_HINTS} />
        )}
      </box>
      <text fg="cyan">{buildBottomBorder(width)}</text>
    </box>
  );
}
