/**
 * Colour and indicator rules for one row of the request list.
 */

import type { InterceptionType } from "../../shared/types.js";

export interface RowIndicator {
  text: string;
  colour?: string;
}

/** "M " for a mocked request, "I " for a modified one, blank otherwise. */
export const getInterceptionIndicator = (type?: InterceptionType): RowIndicator => {
  switch (type) {
    case "mocked":
      return { text: "M ", colour: "magenta" };
    case "modified":
      return { text: "I ", colour: "cyan" };
    default:
      return { text: "  " };
  }
};

/** "R " for a replayed request, blank otherwise. */
export const getReplayIndicator = (replayedFromId?: string): RowIndicator =>
  replayedFromId ? { text: "R ", colour: "yellow" } : { text: "  " };

export const getStatusColour = (status: number | undefined): string => {
  if (status === undefined) {
    return "gray";
  }
  if (status >= 200 && status < 300) {
    return "green";
  }
  if (status >= 300 && status < 400) {
    return "yellow";
  }
  if (status >= 400) {
    return "red";
  }
  return "white";
};

export const getStatusIndicator = (status: number | undefined): string => {
  if (status === undefined) {
    return " ";
  }
  if (status >= 200 && status < 300) {
    return "✓";
  }
  if (status >= 300 && status < 400) {
    return "→";
  }
  return "✗";
};

export const getMethodColour = (method: string): string => {
  switch (method.toUpperCase()) {
    case "GET":
      return "green";
    case "POST":
      return "blue";
    case "PUT":
      return "yellow";
    case "PATCH":
      return "yellow";
    case "DELETE":
      return "magenta";
    default:
      return "white";
  }
};

export interface MatchSegment {
  text: string;
  isMatch: boolean;
}

/**
 * Splits text around case-insensitive matches of a term, so the list can
 * highlight what the filter matched.
 */
export const splitByMatch = (text: string, term: string): MatchSegment[] => {
  if (!term) {
    return [{ text, isMatch: false }];
  }

  const segments: MatchSegment[] = [];
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  let position = 0;

  while (position < text.length) {
    const matchIndex = lowerText.indexOf(lowerTerm, position);
    if (matchIndex === -1) {
      segments.push({ text: text.slice(position), isMatch: false });
      break;
    }
    if (matchIndex > position) {
      segments.push({ text: text.slice(position, matchIndex), isMatch: false });
    }
    segments.push({ text: text.slice(matchIndex, matchIndex + term.length), isMatch: true });
    position = matchIndex + term.length;
  }

  return segments.length > 0 ? segments : [{ text, isMatch: false }];
};
