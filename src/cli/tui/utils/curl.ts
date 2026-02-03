/**
 * Generate curl commands from captured requests.
 */

import type { CapturedRequest } from "../../../shared/types.js";

/**
 * Headers that should be excluded from curl output.
 * These are typically set automatically by curl or are connection-specific.
 */
const EXCLUDED_HEADERS = new Set([
  "host",
  "content-length",
  "connection",
  "accept-encoding",
  "transfer-encoding",
]);

/**
 * Escape a string for use in a shell single-quoted context.
 * Single quotes are handled by ending the quote, adding an escaped single quote, and reopening.
 */
function shellEscape(str: string): string {
  return str.replace(/'/g, "'\"'\"'");
}

/**
 * Generate a curl command from a captured request.
 */
export function generateCurl(request: CapturedRequest): string {
  const parts: string[] = ["curl"];

  // Add method if not GET
  if (request.method !== "GET") {
    parts.push(`-X ${request.method}`);
  }

  // Add URL
  parts.push(`'${shellEscape(request.url)}'`);

  // Add headers (excluding certain automatic ones)
  for (const [name, value] of Object.entries(request.requestHeaders)) {
    if (EXCLUDED_HEADERS.has(name.toLowerCase())) {
      continue;
    }
    parts.push(`-H '${shellEscape(name)}: ${shellEscape(value)}'`);
  }

  // Add body if present
  if (request.requestBody && request.requestBody.length > 0) {
    const bodyStr = request.requestBody.toString("utf-8");
    parts.push(`-d '${shellEscape(bodyStr)}'`);
  }

  return parts.join(" \\\n  ");
}
