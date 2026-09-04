import { afterEach, describe, expect, it, vi } from "vitest";

const runTui = vi.fn<(options: unknown) => Promise<void>>();

vi.mock("./main.js", () => ({ runTui }));

const originalArgv = process.argv;

afterEach(() => {
  process.argv = originalArgv;
  runTui.mockReset();
  vi.restoreAllMocks();
  vi.resetModules();
});

const withArgument = (value: string): void => {
  process.argv = [...originalArgv.slice(0, 2), value];
};

describe("tui entry point", () => {
  it("starts the TUI with the options it was handed", async () => {
    runTui.mockResolvedValue(undefined);
    withArgument(JSON.stringify({ projectRoot: "/tmp/project", ci: true, verbose: 2 }));

    await import("./index.js");

    expect(runTui).toHaveBeenCalledWith(
      expect.objectContaining({ projectRoot: "/tmp/project", ci: true, verbose: 2 })
    );
  });
});
