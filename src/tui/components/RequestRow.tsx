/** @jsxImportSource @opentui/react */

/**
 * One row of the request list. Memoised on the summary object, which the sync
 * engine keeps stable for rows a delta did not touch.
 */

import React from "react";
import type { CapturedRequestSummary } from "../../shared/types.js";
import { formatDuration, formatMethod, truncate } from "../utils/formatters.js";
import {
  getInterceptionIndicator,
  getMethodColour,
  getReplayIndicator,
  getStatusColour,
  getStatusIndicator,
  splitByMatch,
} from "../utils/row-format.js";
import { BOLD, DIM } from "./styles.js";

const INTERCEPTION_WIDTH = 2;
const REPLAY_WIDTH = 2;
const METHOD_WIDTH = 7;
const STATUS_WIDTH = 6;
const DURATION_WIDTH = 8;
const SEPARATORS_WIDTH = 3;
const MIN_PATH_WIDTH = 10;

export interface RequestRowProps {
  request: CapturedRequestSummary;
  isSelected: boolean;
  width: number;
  showFullUrl: boolean;
  searchTerm?: string;
  index: number;
  onSelect: (index: number) => void;
}

export const RequestRow = React.memo(function RequestRow({
  request,
  isSelected,
  width,
  showFullUrl,
  searchTerm,
  index,
  onSelect,
}: RequestRowProps): React.ReactNode {
  const pathWidth = Math.max(
    MIN_PATH_WIDTH,
    width -
      INTERCEPTION_WIDTH -
      REPLAY_WIDTH -
      METHOD_WIDTH -
      STATUS_WIDTH -
      DURATION_WIDTH -
      SEPARATORS_WIDTH
  );
  const paddedPath = truncate(showFullUrl ? request.url : request.path, pathWidth).padEnd(pathWidth);

  const statusText = request.responseStatus?.toString() ?? "...";
  const savedChar = request.saved ? "*" : " ";
  const indicator = isSelected ? `❯${savedChar}` : ` ${savedChar}`;
  const indicatorColour = isSelected ? "cyan" : request.saved ? "yellow" : undefined;
  const interception = getInterceptionIndicator(request.interceptionType);
  const replay = getReplayIndicator(request.replayedFromId);
  const pathAttributes = isSelected ? 0 : DIM;

  return (
    <box width={width} height={1} onMouseDown={() => onSelect(index)}>
      <text wrapMode="none">
        <span fg={indicatorColour}>{indicator}</span>
        <span fg={interception.colour}>{interception.text}</span>
        <span fg={replay.colour}>{replay.text}</span>
        <span fg={getMethodColour(request.method)}>{formatMethod(request.method)}</span>
        <span> </span>
        <span fg={getStatusColour(request.responseStatus)}>
          {`${getStatusIndicator(request.responseStatus)}${statusText.padStart(3)}`}
        </span>
        <span> </span>
        {searchTerm
          ? splitByMatch(paddedPath, searchTerm).map((segment, segmentIndex) =>
              segment.isMatch ? (
                <span key={segmentIndex} fg="yellow" attributes={BOLD}>
                  {segment.text}
                </span>
              ) : (
                <span key={segmentIndex} attributes={pathAttributes}>
                  {segment.text}
                </span>
              )
            )
          : [
              <span key="path" attributes={pathAttributes}>
                {paddedPath}
              </span>,
            ]}
        <span attributes={DIM}>{formatDuration(request.durationMs).padStart(DURATION_WIDTH)}</span>
      </text>
    </box>
  );
});
