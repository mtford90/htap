/**
 * Text attribute helpers. OpenTUI takes a bitmask where Ink took booleans.
 */

import { TextAttributes } from "@opentui/core";

export const DIM = TextAttributes.DIM;
export const BOLD = TextAttributes.BOLD;
export const ITALIC = TextAttributes.ITALIC;
export const UNDERLINE = TextAttributes.UNDERLINE;
export const BOLD_DIM = TextAttributes.BOLD | TextAttributes.DIM;

export interface TextStyle {
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export const attributes = ({ bold, dim, italic, underline }: TextStyle): number =>
  (bold ? BOLD : 0) | (dim ? DIM : 0) | (italic ? ITALIC : 0) | (underline ? UNDERLINE : 0);

/** Border colour follows focus first, then hover, as in the Ink panels. */
export const panelBorderColour = (isActive: boolean, isHovered = false): string =>
  isActive ? "cyan" : isHovered ? "white" : "gray";
