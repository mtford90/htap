import { afterEach, describe, expect, it, vi } from "vitest";
import { supportsFfiFlag, tuiCommand } from "./tui.js";

const runTui = vi.fn<(options: unknown) => Promise<void>>();
const startTui = vi.fn<(options: unknown) => Promise<void>>();

vi.mock("../../tui/main.js", () => ({ runTui, startTui }));

afterEach(() => {
  runTui.mockReset();
  startTui.mockReset();
  vi.unstubAllEnvs();
});

describe("supportsFfiFlag", () => {
  it("accepts the first release that carries node:ffi", () => {
    expect(supportsFfiFlag("v26.4.0")).toBe(true);
  });

  it("accepts later 26.x and every later major", () => {
    expect(supportsFfiFlag("v26.8.1")).toBe(true);
    expect(supportsFfiFlag("v27.0.0")).toBe(true);
  });

  it("rejects earlier releases", () => {
    expect(supportsFfiFlag("v26.3.0")).toBe(false);
    expect(supportsFfiFlag("v24.20.0")).toBe(false);
  });

  it("reads a version without the leading v", () => {
    expect(supportsFfiFlag("26.4.0")).toBe(true);
  });
});

describe("httap tui", () => {
  it("reports a startup failure on the in-process launch path", async () => {
    vi.stubEnv("HTTAP_TUI", "");
    runTui.mockRejectedValue(new Error("renderer setup failed"));
    const originalExecArgv = process.execArgv;
    process.execArgv = ["--experimental-ffi"];

    try {
      await expect(tuiCommand.parseAsync([], { from: "user" })).rejects.toThrow(
        "renderer setup failed"
      );
    } finally {
      process.execArgv = originalExecArgv;
    }

    expect(runTui).toHaveBeenCalledTimes(1);
    expect(startTui).not.toHaveBeenCalled();
  });
});
