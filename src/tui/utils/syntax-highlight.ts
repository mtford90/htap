/**
 * Syntax highlighting for HTTP body content using cli-highlight.
 *
 * Maps content-type shorthands (as produced by shortContentType) to
 * highlight.js language identifiers, then applies terminal ANSI colouring.
 */

import type { highlight as Highlight, supportsLanguage as SupportsLanguage } from "cli-highlight";
import { shortContentType } from "./formatters.js";

/**
 * cli-highlight drags in every highlight.js language, parse5 and yargs, which
 * together are the heaviest import in the TUI's graph. It is loaded after the
 * first frame instead of before it, so bodies render unhighlighted until it
 * lands.
 */
interface Highlighter {
  highlight: typeof Highlight;
  supportsLanguage: typeof SupportsLanguage;
}

let highlighter: Highlighter | undefined;
let loading: Promise<void> | undefined;
let version = 0;
const listeners = new Set<() => void>();

/** Loads the highlighter; the caller is expected to be off the first-frame path. */
export const preloadHighlighter = (): Promise<void> => {
  if (!loading) {
    loading = import("cli-highlight")
      .then((module) => {
        highlighter = module;
        version += 1;
        for (const listener of listeners) {
          listener();
        }
      })
      .catch(() => {
        // A broken install degrades to plain text, the same state as before the
        // module lands, and nothing here may write to the terminal the TUI owns.
        // The promise stays cached so the import is not retried on every
        // keystroke, and the version stays put so nothing re-renders.
      });
  }
  return loading;
};

/**
 * Changes once, when the highlighter lands. Views memoise their highlighted
 * lines, so without this the body on screen at startup would stay plain until
 * something else invalidated it.
 */
export const getHighlighterVersion = (): number => version;

export const subscribeToHighlighter = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Mapping from shortContentType output to highlight.js language names.
 * Only content types that have a meaningful syntax to highlight are included.
 */
const CONTENT_TYPE_TO_LANGUAGE: Record<string, string> = {
  json: "json",
  xml: "xml",
  html: "html",
  javascript: "javascript",
  css: "css",
  // Less common but still useful mappings
  "xhtml+xml": "xml",
  "svg+xml": "xml",
  "rss+xml": "xml",
  "atom+xml": "xml",
  "mathml+xml": "xml",
  "x-javascript": "javascript",
  ecmascript: "javascript",
};

/**
 * Resolve a raw content-type header value to a highlight.js language name.
 * Returns undefined when no suitable language mapping exists.
 */
function resolveLanguage(loaded: Highlighter, contentType: string | undefined): string | undefined {
  const short = shortContentType(contentType);
  if (!short) return undefined;

  const language = CONTENT_TYPE_TO_LANGUAGE[short];
  if (language && loaded.supportsLanguage(language)) {
    return language;
  }

  return undefined;
}

/**
 * Apply syntax highlighting to a code string based on its content type.
 *
 * Returns the original string unchanged when:
 * - The highlighter has not finished loading yet
 * - The content type cannot be mapped to a supported language
 * - The input is empty
 * - highlight.js throws (e.g. on malformed input)
 */
export function highlightCode(code: string, contentType: string | undefined): string {
  if (!code) return code;

  const loaded = highlighter;
  if (!loaded) {
    void preloadHighlighter();
    return code;
  }

  const language = resolveLanguage(loaded, contentType);
  if (!language) return code;

  try {
    return loaded.highlight(code, { language, ignoreIllegals: true });
  } catch {
    // highlight.js can throw on particularly malformed input
    return code;
  }
}
