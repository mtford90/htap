/**
 * Converts the ANSI-coloured output of `cli-highlight` into plain text plus
 * styled segments, because OpenTUI renders escape sequences literally.
 */

/** A fresh instance each time, so no shared `lastIndex` leaks between calls. */
// eslint-disable-next-line no-control-regex
const ansiPattern = (): RegExp => /\u001b\[([0-9;]*)m/g;

/** 4-bit and bright 4-bit SGR foreground codes, as hex OpenTUI accepts. */
const FOREGROUNDS: Record<number, string> = {
  30: "#000000",
  31: "#cd3131",
  32: "#0dbc79",
  33: "#e5e510",
  34: "#2472c8",
  35: "#bc3fbc",
  36: "#11a8cd",
  37: "#e5e5e5",
  90: "#666666",
  91: "#f14c4c",
  92: "#23d18b",
  93: "#f5f543",
  94: "#3b8eea",
  95: "#d670d6",
  96: "#29b8db",
  97: "#ffffff",
};

export interface AnsiSegment {
  text: string;
  fg?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

interface AnsiStyle {
  fg?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/** Reads the 256-colour and 24-bit forms, which need their parameters consumed. */
const readExtendedColour = (codes: number[], index: number): { fg?: string; next: number } => {
  const mode = codes[index + 1];
  if (mode === 5) {
    const value = codes[index + 2] ?? 0;
    return { fg: xterm256ToHex(value), next: index + 3 };
  }
  if (mode === 2) {
    const [r, g, b] = [codes[index + 2] ?? 0, codes[index + 3] ?? 0, codes[index + 4] ?? 0];
    return { fg: toHex(r, g, b), next: index + 5 };
  }
  return { next: index + 1 };
};

const toHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;

const xterm256ToHex = (value: number): string => {
  if (value < 16) {
    return FOREGROUNDS[value < 8 ? value + 30 : value + 82] ?? "#e5e5e5";
  }
  if (value < 232) {
    const level = [0, 95, 135, 175, 215, 255];
    const offset = value - 16;
    return toHex(
      level[Math.floor(offset / 36) % 6] ?? 0,
      level[Math.floor(offset / 6) % 6] ?? 0,
      level[offset % 6] ?? 0
    );
  }
  const grey = 8 + (value - 232) * 10;
  return toHex(grey, grey, grey);
};

const applyCodes = (style: AnsiStyle, codes: number[]): AnsiStyle => {
  let next: AnsiStyle = { ...style };

  for (let index = 0; index < codes.length; index += 1) {
    const code = codes[index] ?? 0;
    if (code === 0) {
      next = {};
    } else if (code === 1) {
      next.bold = true;
    } else if (code === 2) {
      next.dim = true;
    } else if (code === 3) {
      next.italic = true;
    } else if (code === 4) {
      next.underline = true;
    } else if (code === 22) {
      next.bold = undefined;
      next.dim = undefined;
    } else if (code === 23) {
      next.italic = undefined;
    } else if (code === 24) {
      next.underline = undefined;
    } else if (code === 39) {
      next.fg = undefined;
    } else if (code === 38) {
      const extended = readExtendedColour(codes, index);
      next.fg = extended.fg;
      index = extended.next - 1;
    } else if (code in FOREGROUNDS) {
      next.fg = FOREGROUNDS[code];
    }
  }

  return next;
};

const segment = (text: string, style: AnsiStyle): AnsiSegment => ({ text, ...style });

/** Splits an ANSI-coloured string into styled segments, dropping the escapes. */
export const parseAnsi = (input: string): AnsiSegment[] => {
  const segments: AnsiSegment[] = [];
  let style: AnsiStyle = {};
  let cursor = 0;

  const pattern = ansiPattern();
  let match = pattern.exec(input);
  while (match !== null) {
    if (match.index > cursor) {
      segments.push(segment(input.slice(cursor, match.index), style));
    }
    const parameters = match[1] ?? "";
    const codes =
      parameters === "" ? [0] : parameters.split(";").map((part: string) => Number(part) || 0);
    style = applyCodes(style, codes);
    cursor = match.index + match[0].length;
    match = pattern.exec(input);
  }

  if (cursor < input.length) {
    segments.push(segment(input.slice(cursor), style));
  }

  return segments;
};

/**
 * Splits ANSI-coloured text into lines of styled segments, so each terminal row
 * can be rendered as one `<text>` of `<span>`s.
 */
export const parseAnsiLines = (input: string): AnsiSegment[][] => {
  const lines: AnsiSegment[][] = [[]];

  for (const parsed of parseAnsi(input)) {
    const parts = parsed.text.split("\n");
    parts.forEach((part, index) => {
      if (index > 0) {
        lines.push([]);
      }
      if (part.length > 0) {
        lines[lines.length - 1]?.push({ ...parsed, text: part });
      }
    });
  }

  return lines;
};

/** Drops every escape sequence, for measurement and search. */
export const stripAnsi = (input: string): string => input.replace(ansiPattern(), "");
