/**
 * Reusable panel component with lazygit-style border titles.
 * The title is embedded in the top border line: ┌─ Title ─────┐
 */

import React, { forwardRef } from "react";
import { Box, Text, type DOMElement } from "ink";

// Box drawing characters (single line style)
const BOX = {
  topLeft: "┌",
  topRight: "┐",
  horizontal: "─",
} as const;

interface PanelProps {
  title: string;
  /** Optional value to display right-aligned in the title bar */
  rightValue?: string | number;
  /** Optional value to display centred in the title bar */
  centerValue?: string;
  /** Optional colour for the centred value (defaults to border colour) */
  centerColor?: string;
  children: React.ReactNode;
  isActive: boolean;
  isHovered?: boolean;
  width: number;
  height: number;
}

/**
 * Creates the top border line with embedded title and optional right value.
 * Format: ┌─ Title ─────────── 3 ─┐
 *
 * When a centerValue is provided, the dashes between title and right value
 * are split to embed it roughly centred in the available space. The returned
 * object includes segments so the caller can colour the centre independently.
 */

interface TitleLineSegments {
  /** Text before the centre value (including title) */
  before: string;
  /** The centre value text (empty string when not provided) */
  center: string;
  /** Text after the centre value (including right value and closing corner) */
  after: string;
}

function buildTitleLine(
  title: string,
  totalWidth: number,
  rightValue?: string | number,
  centerValue?: string,
): TitleLineSegments {
  const titleWithSpaces = ` ${title} `;
  const leftPart = `${BOX.topLeft}${BOX.horizontal}`;
  const rightValueStr = rightValue !== undefined ? ` ${rightValue} ${BOX.horizontal}` : "";
  const rightPart = BOX.topRight;

  const fixedWidth = leftPart.length + titleWithSpaces.length + rightValueStr.length + rightPart.length;

  if (!centerValue) {
    const remainingWidth = Math.max(1, totalWidth - fixedWidth);
    const dashes = BOX.horizontal.repeat(remainingWidth);
    return {
      before: `${leftPart}${titleWithSpaces}${dashes}${rightValueStr}${rightPart}`,
      center: "",
      after: "",
    };
  }

  const centerWithSpaces = ` ${centerValue} `;
  const totalDashSpace = totalWidth - fixedWidth - centerWithSpaces.length;

  if (totalDashSpace < 2) {
    // Not enough room for the centre value — fall back to no centre
    const remainingWidth = Math.max(1, totalWidth - fixedWidth);
    const dashes = BOX.horizontal.repeat(remainingWidth);
    return {
      before: `${leftPart}${titleWithSpaces}${dashes}${rightValueStr}${rightPart}`,
      center: "",
      after: "",
    };
  }

  const leftDashes = Math.floor(totalDashSpace / 2);
  const rightDashes = totalDashSpace - leftDashes;

  return {
    before: `${leftPart}${titleWithSpaces}${BOX.horizontal.repeat(leftDashes)}`,
    center: centerWithSpaces,
    after: `${BOX.horizontal.repeat(rightDashes)}${rightValueStr}${rightPart}`,
  };
}

export const Panel = forwardRef<DOMElement, PanelProps>(function Panel(
  { title, rightValue, centerValue, centerColor, children, isActive, isHovered, width, height },
  ref,
) {
  // Border colour: active > hovered > default
  const borderColour = isActive ? "cyan" : isHovered ? "white" : "gray";

  const segments = buildTitleLine(title, width, rightValue, centerValue);

  // Height for the bordered box (everything except the custom title line)
  // This box will have left, right, and bottom borders via Ink's borderStyle
  const innerBoxHeight = height - 1;

  return (
    <Box ref={ref} flexDirection="column" width={width} height={height}>
      {/* Custom title line embedded in border */}
      {segments.center ? (
        <Text>
          <Text color={borderColour}>{segments.before}</Text>
          <Text color={centerColor ?? borderColour} bold>{segments.center}</Text>
          <Text color={borderColour}>{segments.after}</Text>
        </Text>
      ) : (
        <Text color={borderColour}>{segments.before}</Text>
      )}

      {/* Content with side and bottom borders */}
      <Box
        flexDirection="column"
        width={width}
        height={innerBoxHeight}
        borderStyle="single"
        borderColor={borderColour}
        borderTop={false}
        overflowY="hidden"
      >
        {children}
      </Box>
    </Box>
  );
});
