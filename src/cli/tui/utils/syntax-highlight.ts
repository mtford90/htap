/**
 * Syntax highlighting for HTTP body content using cli-highlight.
 *
 * Maps content-type shorthands (as produced by shortContentType) to
 * highlight.js language identifiers, then applies terminal ANSI colouring.
 */

import { highlight, supportsLanguage } from "cli-highlight";
import { shortContentType } from "./formatters.js";

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
function resolveLanguage(contentType: string | undefined): string | undefined {
  const short = shortContentType(contentType);
  if (!short) return undefined;

  const language = CONTENT_TYPE_TO_LANGUAGE[short];
  if (language && supportsLanguage(language)) {
    return language;
  }

  return undefined;
}

/**
 * Apply syntax highlighting to a code string based on its content type.
 *
 * Returns the original string unchanged when:
 * - The content type cannot be mapped to a supported language
 * - The input is empty
 * - highlight.js throws (e.g. on malformed input)
 */
export function highlightCode(code: string, contentType: string | undefined): string {
  if (!code) return code;

  const language = resolveLanguage(contentType);
  if (!language) return code;

  try {
    return highlight(code, { language, ignoreIllegals: true });
  } catch {
    // highlight.js can throw on particularly malformed input
    return code;
  }
}
