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
