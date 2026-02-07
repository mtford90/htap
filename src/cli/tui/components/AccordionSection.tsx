/**
 * A collapsible section component for the accordion panel.
 * Shows a divider line with expand/collapse indicator, title, and optional right-aligned accessory text.
 * When expanded, shows content below the divider.
 *
 * This component is designed to be used within an AccordionPanel which provides
 * the outer container with left/right vertical borders and bottom border.
 */

import React from "react";
import { Box, Text } from "ink";

// Box drawing characters
const BOX = {
  topLeft: "┌",
  topRight: "┐",
  midLeft: "├",
  midRight: "┤",
  vertical: "│",
  horizontal: "─",
} as const;

export interface AccordionSectionProps {
  title: string;
  /** Optional value to display right-aligned in the header (e.g., content-type, size) */
  rightValue?: string;
  isExpanded: boolean;
  isFocused: boolean;
  children: React.ReactNode;
  /** Total height allocated to this section (including divider line) */
  height: number;
  /** Total width of the section */
  width: number;
  /** Whether this is the first section (uses ┌─ ─┐ instead of ├─ ─┤) */
  isFirst: boolean;
  /** Border colour to use */
  borderColour: string;
}

/**
 * Creates the divider line with expand/collapse indicator, title, and right value.
 * Format: ├─ ▼ Title ─────────── value ─┤ (or ┌─...─┐ for first section)
 */
export function buildDividerLine(
  title: string,
  isExpanded: boolean,
  isFocused: boolean,
  totalWidth: number,
  isFirst: boolean,
  rightValue?: string,
): string {
  const indicator = isExpanded ? "▼" : "▶";
  const focusMarker = isFocused ? "»" : " ";
  const titleWithSpaces = ` ${focusMarker} ${indicator} ${title} `;

  const leftCorner = isFirst ? BOX.topLeft : BOX.midLeft;
  const rightCorner = isFirst ? BOX.topRight : BOX.midRight;

  const leftPart = `${leftCorner}${BOX.horizontal}`;
  const rightValueStr = rightValue ? ` ${rightValue} ${BOX.horizontal}` : "";
  const rightPart = rightCorner;

  const usedWidth = leftPart.length + titleWithSpaces.length + rightValueStr.length + rightPart.length;
  const remainingWidth = Math.max(1, totalWidth - usedWidth);
  const dashes = BOX.horizontal.repeat(remainingWidth);

  return `${leftPart}${titleWithSpaces}${dashes}${rightValueStr}${rightPart}`;
}


export function AccordionSection({
  title,
  rightValue,
  isExpanded,
  isFocused,
  children,
  height,
  width,
  isFirst,
  borderColour,
}: AccordionSectionProps): React.ReactElement {
  const dividerLine = buildDividerLine(title, isExpanded, isFocused, width, isFirst, rightValue);

  // When collapsed, only show the divider line
  // Use wrap="truncate" to prevent ink from wrapping the text
  if (!isExpanded) {
    return <Text color={borderColour} bold={isFocused} wrap="truncate">{dividerLine}</Text>;
  }

  // When expanded, show divider + content with left/right borders
  const contentHeight = height - 1;

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text color={borderColour} bold={isFocused}>{dividerLine}</Text>
      <Box
        flexDirection="column"
        width={width}
        height={contentHeight}
        borderStyle="single"
        borderColor={borderColour}
        borderTop={false}
        borderBottom={false}
        overflowY="hidden"
        paddingLeft={1}
      >
        {children}
      </Box>
    </Box>
  );
}
