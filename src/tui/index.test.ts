import { afterEach, describe, expect, it, vi } from "vitest";

const startTui = vi.fn<(options: unknown) => Promise<void>>();

vi.mock("./main.js", () => ({ startTui }));

const originalArgv = process.argv;

afterEach(() => {
  process.argv = originalArgv;
  startTui.mockReset();
  vi.restoreAllMocks();
  vi.resetModules();
});

const withArgument = (value: string): void => {
  process.argv = [...originalArgv.slice(0, 2), value];
};

describe("tui entry point", () => {
  it("starts the TUI with the options it was handed", async () => {
    startTui.mockResolvedValue(undefined);
    withArgument(JSON.stringify({ projectRoot: "/tmp/project", ci: true, verbose: 2 }));

    await import("./index.js");

    expect(startTui).toHaveBeenCalledWith(
      expect.objectContaining({ projectRoot: "/tmp/project", ci: true, verbose: 2 })
    );
  });

  it("reports a startup failure on stderr and exits non-zero", async () => {
    startTui.mockRejectedValue(new Error("ffi library missing"));
    withArgument("{}");
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);
    const write = vi.spyOn(process.stderr, "write").mockReturnValue(true);

    await expect(import("./index.js")).rejects.toThrow("process.exit:1");

    expect(write).toHaveBeenCalledWith(expect.stringContaining("ffi library missing"));
    expect(exit).toHaveBeenCalledWith(1);
  });
});
