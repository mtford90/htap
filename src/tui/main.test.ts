import { afterEach, describe, expect, it, vi } from "vitest";

const EXIT_SENTINEL = "process.exit";

const createCliRenderer = vi.fn();
const createRoot = vi.fn(() => ({ render: vi.fn(), unmount: vi.fn() }));

vi.mock("@opentui/core", () => ({ createCliRenderer }));
vi.mock("@opentui/react", () => ({ createRoot }));
vi.mock("./App.js", () => ({ App: () => null }));

const fakeRenderer = () => ({ destroy: vi.fn() });

const listenedEvents = [
  "SIGHUP",
  "SIGTERM",
  "SIGINT",
  "uncaughtException",
  "unhandledRejection",
] as const;

const preexisting = new Map<(typeof listenedEvents)[number], Set<unknown>>(
  listenedEvents.map((event) => [event, new Set<unknown>(process.listeners(event))])
);

afterEach(() => {
  for (const event of listenedEvents) {
    for (const listener of process.listeners(event)) {
      if (!preexisting.get(event)?.has(listener)) {
        process.removeListener(event, listener);
      }
    }
  }
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const stubExit = () =>
  vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`${EXIT_SENTINEL}:${code ?? 0}`);
  }) as never);

describe("startTui", () => {
  it("exits when the renderer is destroyed before it is returned", async () => {
    const exit = stubExit();
    createCliRenderer.mockImplementation(async (options: { onDestroy: () => void }) => {
      options.onDestroy();
      return fakeRenderer();
    });
    const { startTui } = await import("./main.js");

    await expect(startTui({})).rejects.toThrow(`${EXIT_SENTINEL}:0`);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("keeps the TUI running after an unhandled rejection", async () => {
    const exit = stubExit();
    createCliRenderer.mockImplementation(async () => fakeRenderer());
    const { startTui } = await import("./main.js");

    await startTui({});
    const installed = process
      .listeners("unhandledRejection")
      .filter((listener) => !preexisting.get("unhandledRejection")?.has(listener));

    expect(installed).toHaveLength(1);
    installed[0]?.(new Error("export failed"), Promise.resolve());

    expect(exit).not.toHaveBeenCalled();
  });
});
