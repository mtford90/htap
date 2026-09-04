/** @jsxImportSource @opentui/react */

/**
 * A bordered panel whose title, badge and count live inside the top border.
 * OpenTUI's own `title` prop takes a single string per alignment, so the top
 * line is drawn as text and the box below carries the remaining three sides.
 */

import React from "react";
import { buildTitleLine } from "./panel-chrome.js";
import { BOLD, panelBorderColour } from "./styles.js";

export interface PanelProps {
  title: string;
  rightValue?: string | number;
  centerValue?: string;
  centerColour?: string;
  isActive: boolean;
  isHovered?: boolean;
  width: number;
  height: number;
  onMouseDown?: () => void;
  onScroll?: (delta: number) => void;
  onMouseOver?: () => void;
  onMouseOut?: () => void;
  children?: React.ReactNode;
}

export function Panel({
  title,
  rightValue,
  centerValue,
  centerColour,
  isActive,
  isHovered,
  width,
  height,
  onMouseDown,
  onScroll,
  onMouseOver,
  onMouseOut,
  children,
}: PanelProps): React.ReactNode {
  const borderColour = panelBorderColour(isActive, isHovered);
  const segments = buildTitleLine(title, width, rightValue, centerValue);

  return (
    <box
      flexDirection="column"
      width={width}
      height={height}
      onMouseDown={onMouseDown}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
      onMouseScroll={(event) => onScroll?.(event.scroll?.direction === "up" ? -1 : 1)}
    >
      {segments.center ? (
        <text height={1}>
          <span fg={borderColour}>{segments.before}</span>
          <span fg={centerColour ?? borderColour} attributes={BOLD}>
            {segments.center}
          </span>
          <span fg={borderColour}>{segments.after}</span>
        </text>
      ) : (
        <text height={1} fg={borderColour}>
          {segments.before}
        </text>
      )}

      <box
        flexDirection="column"
        width={width}
        height={height - 1}
        border={["left", "right", "bottom"]}
        borderStyle="single"
        borderColor={borderColour}
        overflow="hidden"
      >
        {children}
      </box>
    </box>
  );
}
