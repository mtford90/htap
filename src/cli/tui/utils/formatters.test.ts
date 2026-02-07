import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatRelativeTime,
  formatDuration,
  formatSize,
  truncate,
  padRight,
  padLeft,
  formatMethod,
  formatStatus,
} from "./formatters.js";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should format seconds ago", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 5000)).toBe("5s ago");
    expect(formatRelativeTime(now - 30000)).toBe("30s ago");
    expect(formatRelativeTime(now - 59000)).toBe("59s ago");
  });

  it("should format minutes ago", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 60000)).toBe("1m ago");
    expect(formatRelativeTime(now - 300000)).toBe("5m ago");
    expect(formatRelativeTime(now - 3540000)).toBe("59m ago");
  });

  it("should format hours ago", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 3600000)).toBe("1h ago");
    expect(formatRelativeTime(now - 7200000)).toBe("2h ago");
    expect(formatRelativeTime(now - 82800000)).toBe("23h ago");
  });

  it("should format days ago", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 86400000)).toBe("1d ago");
    expect(formatRelativeTime(now - 172800000)).toBe("2d ago");
  });

  it("should handle timestamp equal to now (0 seconds ago)", () => {
    const now = Date.now();
    expect(formatRelativeTime(now)).toBe("0s ago");
  });

  it("should handle future timestamps (negative diff)", () => {
    const now = Date.now();
    // Future timestamp results in negative seconds, Math.floor makes it more negative
    expect(formatRelativeTime(now + 5000)).toBe("-5s ago");
  });
});

describe("formatDuration", () => {
  it("should format milliseconds", () => {
    expect(formatDuration(0)).toBe("0ms");
    expect(formatDuration(100)).toBe("100ms");
    expect(formatDuration(999)).toBe("999ms");
  });

  it("should format seconds", () => {
    expect(formatDuration(1000)).toBe("1.0s");
    expect(formatDuration(1500)).toBe("1.5s");
    expect(formatDuration(59999)).toBe("60.0s");
  });

  it("should format minutes and seconds", () => {
    expect(formatDuration(60000)).toBe("1m0s");
    expect(formatDuration(90000)).toBe("1m30s");
    expect(formatDuration(125000)).toBe("2m5s");
  });

  it("should return dash for undefined", () => {
    expect(formatDuration(undefined)).toBe("-");
  });
});

describe("formatSize", () => {
  it("should format bytes", () => {
    expect(formatSize(0)).toBe("-");
    expect(formatSize(1)).toBe("1B");
    expect(formatSize(512)).toBe("512B");
    expect(formatSize(1023)).toBe("1023B");
  });

  it("should format kilobytes", () => {
    expect(formatSize(1024)).toBe("1.0KB");
    expect(formatSize(1536)).toBe("1.5KB");
    expect(formatSize(10240)).toBe("10.0KB");
  });

  it("should format megabytes", () => {
    expect(formatSize(1048576)).toBe("1.0MB");
    expect(formatSize(1572864)).toBe("1.5MB");
  });

  it("should format gigabytes", () => {
    expect(formatSize(1073741824)).toBe("1.0GB");
  });

  it("should return dash for undefined", () => {
    expect(formatSize(undefined)).toBe("-");
  });

  it("should handle very large sizes (TB+)", () => {
    // 1 TB = 1024^4 = 1099511627776
    // Since units only go to GB, this should show as GB
    expect(formatSize(1099511627776)).toBe("1024.0GB");
  });

  it("should handle negative numbers", () => {
    // Negative bytes makes no semantic sense but shouldn't crash
    // The while loop won't execute since -1 < 1024, unitIndex stays 0
    expect(formatSize(-1)).toBe("-1B");
  });
});

describe("truncate", () => {
  it("should not truncate short strings", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("should truncate long strings with ellipsis", () => {
    expect(truncate("hello world", 8)).toBe("hello w…");
    expect(truncate("hello world", 5)).toBe("hell…");
  });
});

describe("padRight", () => {
  it("should pad short strings", () => {
    expect(padRight("hi", 5)).toBe("hi   ");
    expect(padRight("", 3)).toBe("   ");
  });

  it("should truncate long strings", () => {
    expect(padRight("hello", 3)).toBe("hel");
  });

  it("should not modify strings of exact length", () => {
    expect(padRight("hello", 5)).toBe("hello");
  });
});

describe("padLeft", () => {
  it("should pad short strings", () => {
    expect(padLeft("hi", 5)).toBe("   hi");
    expect(padLeft("", 3)).toBe("   ");
  });

  it("should truncate long strings", () => {
    expect(padLeft("hello", 3)).toBe("hel");
  });

  it("should not modify strings of exact length", () => {
    expect(padLeft("hello", 5)).toBe("hello");
  });
});

describe("formatMethod", () => {
  it("should format HTTP methods to consistent width", () => {
    expect(formatMethod("GET")).toBe("GET    ");
    expect(formatMethod("POST")).toBe("POST   ");
    expect(formatMethod("DELETE")).toBe("DELETE ");
    expect(formatMethod("OPTIONS")).toBe("OPTIONS");
  });

  it("should uppercase methods", () => {
    expect(formatMethod("get")).toBe("GET    ");
    expect(formatMethod("post")).toBe("POST   ");
  });
});

describe("formatStatus", () => {
  it("should format status codes", () => {
    expect(formatStatus(200)).toBe("200");
    expect(formatStatus(404)).toBe("404");
    expect(formatStatus(500)).toBe("500");
  });

  it("should return ellipsis for undefined", () => {
    expect(formatStatus(undefined)).toBe("...");
  });
});
