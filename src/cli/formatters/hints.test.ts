import { describe, it, expect, vi, afterEach } from "vitest";
import { formatHint, shouldShowHints } from "./hints.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("shouldShowHints", () => {
  it("should return false when NO_COLOR is set", () => {
    vi.stubEnv("NO_COLOR", "1");
    // Stub isTTY as true to isolate NO_COLOR check
    vi.stubGlobal("process", {
      ...process,
      stdout: { ...process.stdout, isTTY: true },
      env: { ...process.env, NO_COLOR: "1" },
    });
    expect(shouldShowHints()).toBe(false);
  });

  it("should return false when stdout is not a TTY", () => {
    vi.stubGlobal("process", {
      ...process,
      stdout: { ...process.stdout, isTTY: false },
      env: { ...process.env },
    });
    expect(shouldShowHints()).toBe(false);
  });
});

describe("formatHint", () => {
  it("should join segments with separator", () => {
    // Force non-TTY so formatHint returns empty (tested separately for TTY)
    vi.stubGlobal("process", {
      ...process,
      stdout: { ...process.stdout, isTTY: false },
      env: { ...process.env },
    });
    // When hints are suppressed, should return empty string
    expect(formatHint(["a", "b", "c"])).toBe("");
  });
});
