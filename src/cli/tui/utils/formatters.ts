/**
 * Formatting utilities for TUI display.
 */

/**
 * Format a timestamp as a relative time string (e.g., "2s ago", "5m ago").
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) {
    return `${diffSec}s ago`;
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return `${diffHour}h ago`;
  }

  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

/**
 * Format duration in milliseconds to a human-readable string.
 */
export function formatDuration(durationMs: number | undefined): string {
  if (durationMs === undefined) {
    return "-";
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const seconds = durationMs / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m${remainingSeconds}s`;
}

/**
 * Format byte size to human-readable string.
 */
export function formatSize(bytes: number | undefined): string {
  if (bytes === undefined || bytes === 0) {
    return "-";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  const unit = units[unitIndex];
  if (unit === undefined) {
    return `${bytes}B`;
  }

  if (unitIndex === 0) {
    return `${size}${unit}`;
  }

  return `${size.toFixed(1)}${unit}`;
}

/**
 * Truncate a string to a maximum length, adding ellipsis if needed.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 1) + "…";
}

/**
 * Pad a string to a fixed width (left-aligned by default).
 */
export function padRight(str: string, width: number): string {
  if (str.length >= width) {
    return str.slice(0, width);
  }
  return str + " ".repeat(width - str.length);
}

/**
 * Pad a string to a fixed width (right-aligned).
 */
export function padLeft(str: string, width: number): string {
  if (str.length >= width) {
    return str.slice(0, width);
  }
  return " ".repeat(width - str.length) + str;
}

/**
 * Format HTTP method with consistent width.
 */
export function formatMethod(method: string): string {
  return padRight(method.toUpperCase(), 7);
}

/**
 * Format HTTP status code.
 */
export function formatStatus(status: number | undefined): string {
  if (status === undefined) {
    return "...";
  }
  return String(status);
}

/**
 * Standard HTTP status text lookup.
 */
const HTTP_STATUS_TEXT: Record<number, string> = {
  // 1xx Informational
  100: "Continue",
  101: "Switching Protocols",
  102: "Processing",
  103: "Early Hints",

  // 2xx Success
  200: "OK",
  201: "Created",
  202: "Accepted",
  203: "Non-Authoritative Information",
  204: "No Content",
  205: "Reset Content",
  206: "Partial Content",
  207: "Multi-Status",

  // 3xx Redirection
  300: "Multiple Choices",
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  304: "Not Modified",
  307: "Temporary Redirect",
  308: "Permanent Redirect",

  // 4xx Client Error
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  407: "Proxy Authentication Required",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  411: "Length Required",
  412: "Precondition Failed",
  413: "Content Too Large",
  414: "URI Too Long",
  415: "Unsupported Media Type",
  416: "Range Not Satisfiable",
  417: "Expectation Failed",
  418: "I'm a Teapot",
  422: "Unprocessable Content",
  429: "Too Many Requests",
  431: "Request Header Fields Too Large",

  // 5xx Server Error
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  505: "HTTP Version Not Supported",
  507: "Insufficient Storage",
  511: "Network Authentication Required",
};

/**
 * Get the standard text for an HTTP status code.
 */
export function getStatusText(status: number | undefined): string {
  if (status === undefined) {
    return "";
  }
  return HTTP_STATUS_TEXT[status] ?? "";
}

/**
 * Extract short content type for display (e.g., "application/json" -> "json")
 */
export function shortContentType(contentType: string | undefined): string {
  if (!contentType) return "";
  // Extract the main type (before any parameters like charset)
  const mainType = contentType.split(";")[0]?.trim() ?? "";
  // For common types, show just the subtype
  if (mainType.startsWith("application/")) {
    return mainType.replace("application/", "");
  }
  if (mainType.startsWith("text/")) {
    return mainType.replace("text/", "");
  }
  return mainType;
}
