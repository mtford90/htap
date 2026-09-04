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

describe("httap tui without FFI already enabled", () => {
  const stubExit = () =>
    vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? 0}`);
    }) as never);

  // The current Node running the test suite always supports the flag (it's
  // httap's own minimum), so this exercises the "supported but missing"
  // branch; `supportsFfiFlag` itself is covered above for the version
  // arithmetic, since `process.versions.node` can't be reassigned here.
  it("reports how to get the flag on a supported Node that lacks it", async () => {
    vi.stubEnv("HTTAP_TUI", "");
    vi.stubEnv("NODE_OPTIONS", "");
    const originalExecArgv = process.execArgv;
    process.execArgv = [];
    const exit = stubExit();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      await expect(tuiCommand.parseAsync([], { from: "user" })).rejects.toThrow("exit:1");
      expect(error).toHaveBeenCalledWith(expect.stringContaining("--experimental-ffi"));
      expect(runTui).not.toHaveBeenCalled();
    } finally {
      process.execArgv = originalExecArgv;
      exit.mockRestore();
      error.mockRestore();
    }
  });
});
