/**
 * Builders for the lazygit-style border lines that carry a panel's title,
 * an optional centred badge and an optional right-aligned value.
 */

const BOX = {
  topLeft: "┌",
  topRight: "┐",
  midLeft: "├",
  midRight: "┤",
  bottomLeft: "└",
  bottomRight: "┘",
  horizontal: "─",
} as const;

export interface TitleLineSegments {
  /** Everything up to the centred badge, including the title. */
  before: string;
  /** The centred badge, empty when there is none or no room for one. */
  center: string;
  /** Everything after the badge, including the right value and the corner. */
  after: string;
}

/**
 * Builds `┌─ Title ─────── badge ─────── 3 ─┐`.
 * The badge is dropped when fewer than two dashes would remain around it.
 */
export const buildTitleLine = (
  title: string,
  totalWidth: number,
  rightValue?: string | number,
  centerValue?: string
): TitleLineSegments => {
  const titleWithSpaces = ` ${title} `;
  const leftPart = `${BOX.topLeft}${BOX.horizontal}`;
  const rightValueStr = rightValue !== undefined ? ` ${rightValue} ${BOX.horizontal}` : "";
  const fixedWidth =
    leftPart.length + titleWithSpaces.length + rightValueStr.length + BOX.topRight.length;

  const withoutCentre = (): TitleLineSegments => ({
    before: `${leftPart}${titleWithSpaces}${BOX.horizontal.repeat(
      Math.max(1, totalWidth - fixedWidth)
    )}${rightValueStr}${BOX.topRight}`,
    center: "",
    after: "",
  });

  if (!centerValue) {
    return withoutCentre();
  }

  const centerWithSpaces = ` ${centerValue} `;
  const totalDashSpace = totalWidth - fixedWidth - centerWithSpaces.length;
  if (totalDashSpace < 2) {
    return withoutCentre();
  }

  const leftDashes = Math.floor(totalDashSpace / 2);
  return {
    before: `${leftPart}${titleWithSpaces}${BOX.horizontal.repeat(leftDashes)}`,
    center: centerWithSpaces,
    after: `${BOX.horizontal.repeat(totalDashSpace - leftDashes)}${rightValueStr}${BOX.topRight}`,
  };
};

/**
 * Builds an accordion divider, `├─ » ▼ Title ──────── value ─┤`, or the
 * `┌ ┐` variant for the first section.
 */
export const buildDividerLine = (
  title: string,
  isExpanded: boolean,
  isFocused: boolean,
  totalWidth: number,
  isFirst: boolean,
  rightValue?: string
): string => {
  const indicator = isExpanded ? "▼" : "▶";
  const focusMarker = isFocused ? "»" : " ";
  const titleWithSpaces = ` ${focusMarker} ${indicator} ${title} `;

  const leftPart = `${isFirst ? BOX.topLeft : BOX.midLeft}${BOX.horizontal}`;
  const rightCorner = isFirst ? BOX.topRight : BOX.midRight;
  const rightValueStr = rightValue ? ` ${rightValue} ${BOX.horizontal}` : "";

  const usedWidth =
    leftPart.length + titleWithSpaces.length + rightValueStr.length + rightCorner.length;
  const dashes = BOX.horizontal.repeat(Math.max(1, totalWidth - usedWidth));

  return `${leftPart}${titleWithSpaces}${dashes}${rightValueStr}${rightCorner}`;
};

export const buildBottomBorder = (width: number): string =>
  `${BOX.bottomLeft}${BOX.horizontal.repeat(Math.max(0, width - 2))}${BOX.bottomRight}`;

export const buildDivider = (width: number): string =>
  `${BOX.midLeft}${BOX.horizontal.repeat(Math.max(0, width - 2))}${BOX.midRight}`;

/** Builds a modal header such as `┌─ Response Body ──── json 1.2 KB ─┐`. */
export const buildModalHeader = (title: string, width: number, rightValue: string): string => {
  const titlePart = ` ${title} `;
  const dashes = Math.max(0, width - titlePart.length - rightValue.length - 4);
  return `${BOX.topLeft}${BOX.horizontal}${titlePart}${BOX.horizontal.repeat(dashes)}${rightValue}${BOX.horizontal}${BOX.topRight}`;
};
