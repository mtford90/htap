/** @jsxImportSource @opentui/react */

/**
 * Full-screen pager for a text body, with line numbers, syntax highlighting
 * and less-style search. The scrollbox owns the viewport and the command table
 * owns every key.
 */

import React, { useMemo } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { visibleHints } from "../commands/table.js";
import { useScroller } from "../hooks/useScroller.js";
import type { TuiActions, TuiStore } from "../store/store.js";
import { highlightCode } from "../utils/syntax-highlight.js";
import { parseAnsiLines, type AnsiSegment } from "../utils/ansi-spans.js";
import { formatSize } from "../utils/formatters.js";
import { matchingLineIndices } from "../utils/text-search.js";
import { Hints } from "./Hints.js";
import { buildBottomBorder, buildDivider, buildModalHeader } from "./panel-chrome.js";
import { attributes, DIM } from "./styles.js";

const SEARCH_FIELD_WIDTH = 40;

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
    <text height={1} flexShrink={0} wrapMode="none">
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
  store: TuiStore;
  actions: TuiActions;
  text: string;
  title: string;
  contentType: string;
  bodySize: number;
  width: number;
  height: number;
}

export function TextViewerModal({
  store,
  actions,
  text,
  title,
  contentType,
  bodySize,
  width,
  height,
}: TextViewerModalProps): React.ReactNode {
  const { searchOpen, searchText, matchIndex } = useStore(
    store,
    useShallow((state) => state.modals.text)
  );
  const statusMessage = useStore(store, (state) => state.ui.statusMessage);
  const hints = useStore(store, useShallow(visibleHints));
  const { ref, scrollTop, syncScrollTop } = useScroller("text", actions);

  const lines = useMemo(
    () => parseAnsiLines(highlightCode(text, contentType)),
    [text, contentType]
  );
  const totalLines = lines.length;
  const lineNumberWidth = String(totalLines).length;

  /** Matching is done against the raw text so escapes cannot mask a hit. */
  const matchLines = useMemo(() => matchingLineIndices(text, searchText), [text, searchText]);
  const matchLineSet = useMemo(() => new Set(matchLines), [matchLines]);
  const currentMatchLine = matchLines[matchIndex];

  const shortContentType = contentType.split(";")[0]?.trim() ?? "";
  const headerBorder = buildModalHeader(
    title,
    width,
    ` ${shortContentType} ${formatSize(bodySize)} `
  );
  const divider = buildDivider(width);

  return (
    <box flexDirection="column" width={width} height={height} onMouseScroll={syncScrollTop}>
      <text fg="cyan">{headerBorder}</text>

      <box height={1} flexShrink={0} paddingLeft={1} paddingRight={1} flexDirection="row">
        {searchOpen ? (
          <>
            <text wrapMode="none">
              <span fg="yellow">search: </span>
            </text>
            <input
              focused
              value=""
              onInput={(value) => actions.patchTextView({ searchText: value })}
              width={SEARCH_FIELD_WIDTH}
              flexShrink={0}
            />
          </>
        ) : (
          <text wrapMode="none" attributes={DIM}>
            {matchLines.length > 0
              ? `Line ${scrollTop + 1}/${totalLines} | ${matchLines.length} match${matchLines.length === 1 ? "" : "es"} (${matchIndex + 1}/${matchLines.length})`
              : `Line ${scrollTop + 1}/${totalLines}`}
          </text>
        )}
      </box>

      <text fg="cyan">{divider}</text>

      <scrollbox
        ref={ref}
        flexGrow={1}
        flexBasis={0}
        minHeight={0}
        viewportCulling
        scrollbarOptions={{ visible: false }}
        contentOptions={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1 }}
      >
        {lines.map((segments, index) => (
          <TextLine
            key={index}
            lineNumber={index + 1}
            lineNumberWidth={lineNumberWidth}
            segments={segments}
            isMatch={matchLineSet.has(index)}
            isCurrentMatch={index === currentMatchLine}
          />
        ))}
      </scrollbox>

      <text fg="cyan">{divider}</text>
      <box height={1} flexShrink={0} paddingLeft={1} paddingRight={1}>
        {statusMessage ? (
          <text wrapMode="none" fg="green">
            {statusMessage}
          </text>
        ) : (
          <Hints hints={hints} />
        )}
      </box>
      <text fg="cyan">{buildBottomBorder(width)}</text>
    </box>
  );
}
