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
  children: React.ReactNode;
  isActive: boolean;
  isHovered?: boolean;
  width: number;
  height: number;
}

/**
 * Creates the top border line with embedded title and optional right value.
 * Format: ┌─ Title ─────────── 3 ─┐
 */
function buildTitleLine(title: string, totalWidth: number, rightValue?: string | number): string {
  const titleWithSpaces = ` ${title} `;
  const leftPart = `${BOX.topLeft}${BOX.horizontal}`;
  const rightValueStr = rightValue !== undefined ? ` ${rightValue} ${BOX.horizontal}` : "";
  const rightPart = BOX.topRight;

  const usedWidth = leftPart.length + titleWithSpaces.length + rightValueStr.length + rightPart.length;
  const remainingWidth = Math.max(1, totalWidth - usedWidth);
  const dashes = BOX.horizontal.repeat(remainingWidth);

  return `${leftPart}${titleWithSpaces}${dashes}${rightValueStr}${rightPart}`;
}

export const Panel = forwardRef<DOMElement, PanelProps>(function Panel(
  { title, rightValue, children, isActive, isHovered, width, height },
  ref,
) {
  // Border colour: active > hovered > default
  const borderColour = isActive ? "cyan" : isHovered ? "white" : "gray";

  const titleLine = buildTitleLine(title, width, rightValue);

  // Height for the bordered box (everything except the custom title line)
  // This box will have left, right, and bottom borders via Ink's borderStyle
  const innerBoxHeight = height - 1;

  return (
    <Box ref={ref} flexDirection="column" width={width} height={height}>
      {/* Custom title line embedded in border */}
      <Text color={borderColour}>{titleLine}</Text>

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
