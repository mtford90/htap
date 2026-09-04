import { afterEach, describe, expect, it, vi } from "vitest";
import type { CliRenderer } from "@opentui/core";
import type { TuiStore } from "./store/store.js";

const EXIT_SENTINEL = "process.exit";

const createCliRenderer = vi.fn();
const createRoot = vi.fn(() => ({ render: vi.fn(), unmount: vi.fn() }));

vi.mock("@opentui/core", () => ({
  createCliRenderer,
  CliRenderEvents: { FRAME: "frame" },
}));
vi.mock("@opentui/react", () => ({ createRoot }));
vi.mock("./App.js", () => ({ App: () => null }));

const fakeRenderer = () => {
  const frameListeners = new Set<() => void>();
  return {
    destroy: vi.fn(),
    on: vi.fn((_event: string, callback: () => void) => {
      frameListeners.add(callback);
    }),
    off: vi.fn((_event: string, callback: () => void) => {
      frameListeners.delete(callback);
    }),
    emitFrame: (): void => {
      for (const callback of [...frameListeners]) {
        callback();
      }
    },
  };
};

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
  it("reports a setup failure that destroys the renderer instead of exiting cleanly", async () => {
    const exit = stubExit();
    createCliRenderer.mockImplementation(async (options: { onDestroy: () => void }) => {
      options.onDestroy();
      throw new Error("terminal setup failed");
    });
    const { startTui } = await import("./main.js");

    await expect(startTui({})).rejects.toThrow("terminal setup failed");
    expect(exit).not.toHaveBeenCalled();
  });

  it("exits when the renderer is destroyed after startup", async () => {
    const exit = stubExit();
    let destroyed: (() => void) | undefined;
    createCliRenderer.mockImplementation(async (options: { onDestroy: () => void }) => {
      destroyed = options.onDestroy;
      return fakeRenderer();
    });
    const { startTui } = await import("./main.js");
    await startTui({});

    expect(() => destroyed?.()).toThrow(`${EXIT_SENTINEL}:0`);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("hands the terminal back when teardown throws", async () => {
    const exit = stubExit();
    const renderer = fakeRenderer();
    let destroyed: (() => void) | undefined;
    createCliRenderer.mockImplementation(async (options: { onDestroy: () => void }) => {
      destroyed = options.onDestroy;
      return renderer;
    });
    createRoot.mockImplementationOnce(() => ({
      render: vi.fn(),
      unmount: vi.fn(() => {
        throw new Error("effect cleanup failed");
      }),
    }));
    const { startTui } = await import("./main.js");
    await startTui({});

    expect(() => destroyed?.()).toThrow(`${EXIT_SENTINEL}:0`);
    expect(renderer.destroy).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("hands the terminal back when the render throws", async () => {
    const exit = stubExit();
    const renderer = fakeRenderer();
    createCliRenderer.mockImplementation(async () => renderer);
    createRoot.mockImplementationOnce(() => ({
      render: vi.fn(() => {
        throw new Error("render failed");
      }),
      unmount: vi.fn(),
    }));
    const { startTui } = await import("./main.js");

    await expect(startTui({})).rejects.toThrow("render failed");

    expect(renderer.destroy).toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
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

describe("startTui ci mode", () => {
  it("exits once a ready frame arrives, without waiting on a fixed timer", async () => {
    const exit = stubExit();
    const renderer = fakeRenderer();
    createCliRenderer.mockImplementation(async () => renderer);
    const { startTui } = await import("./main.js");

    // No projectRoot resolves to the "not in a project" error before the
    // renderer exists, so `requests.loading` is already false: the very
    // first frame satisfies readiness.
    await startTui({ ci: true });
    expect(exit).not.toHaveBeenCalled();

    renderer.emitFrame();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(exit).toHaveBeenCalledWith(0);
  });

  it("falls back to a bounded timeout if no ready frame ever arrives", async () => {
    vi.useFakeTimers();
    try {
      const exit = stubExit();
      const renderer = fakeRenderer();
      createCliRenderer.mockImplementation(async () => renderer);
      const { startTui } = await import("./main.js");

      await startTui({ ci: true });
      expect(exit).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(6_000);

      expect(exit).toHaveBeenCalledWith(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("waitForCiReadyFrame", () => {
  it("resolves only on a frame painted after the list has data", async () => {
    const { waitForCiReadyFrame } = await import("./main.js");
    const renderer = fakeRenderer();
    let loading = true;
    const store = { getState: () => ({ requests: { loading } }) } as unknown as TuiStore;

    let resolved = false;
    void waitForCiReadyFrame(renderer as unknown as CliRenderer, store).then(() => {
      resolved = true;
    });

    renderer.emitFrame();
    await Promise.resolve();
    expect(resolved).toBe(false);

    loading = false;
    renderer.emitFrame();
    await Promise.resolve();
    expect(resolved).toBe(true);
  });
});

describe("runTui", () => {
  it("reports a startup failure on stderr and exits non-zero", async () => {
    const exit = stubExit();
    const write = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    createCliRenderer.mockImplementation(async () => {
      throw new Error("terminal setup failed");
    });
    const { runTui } = await import("./main.js");

    await expect(runTui({})).rejects.toThrow(`${EXIT_SENTINEL}:1`);

    expect(write).toHaveBeenCalledWith(expect.stringContaining("terminal setup failed"));
    expect(exit).toHaveBeenCalledWith(1);
  });
});
