/** @jsxImportSource @opentui/react */

import { afterEach, describe, expect, it, vi } from "vitest";
import { InfoBar } from "./InfoBar.js";
import { StatusBar } from "./StatusBar.js";
import { Hints } from "./Hints.js";
import { visibleHints } from "../commands/table.js";
import { createTuiActions, createTuiStore } from "../store/store.js";
import { destroyRenderers, fullRequest, renderTui, summary } from "../test-support/render.js";

afterEach(() => {
  destroyRenderers();
  vi.useRealTimers();
});

const hintsFor = (configure?: (actions: ReturnType<typeof createTuiActions>) => void) => {
  const store = createTuiStore({ startTime: 0 });
  configure?.(createTuiActions(store));
  return visibleHints(store.getState());
};

describe("Hints", () => {
  it("renders each key with its action, separated by pipes", async () => {
    const setup = await renderTui(
      <Hints
        hints={[
          { key: "j/k", action: "nav" },
          { key: "q", action: "quit" },
        ]}
      />,
      { width: 60, height: 3 }
    );

    expect(setup.captureCharFrame()).toContain("j/k nav │ q quit");
  });

  it("renders nothing for an empty list", async () => {
    const setup = await renderTui(<Hints hints={[]} />, { width: 60, height: 3 });

    expect(setup.captureCharFrame().trim()).toBe("");
  });
});

describe("StatusBar", () => {
  it("shows the base hints when nothing is selected", async () => {
    const setup = await renderTui(<StatusBar hints={hintsFor()} width={120} />, {
      width: 120,
      height: 4,
    });

    const frame = setup.captureCharFrame();
    expect(frame).toContain("j/k nav");
    expect(frame).toContain("q quit");
    expect(frame).not.toContain("replay");
  });

  it("adds the selection hints once a request is open", async () => {
    const hints = hintsFor((actions) => {
      actions.setRequests([summary("a")]);
      actions.setDetail("a", fullRequest());
    });
    const setup = await renderTui(<StatusBar hints={hints} width={160} />, {
      width: 160,
      height: 4,
    });

    const frame = setup.captureCharFrame();
    expect(frame).toContain("R replay");
    expect(frame).toContain("b bookmark");
    expect(frame).toContain("F follow");
  });

  it("shows a transient message in place of the hints", async () => {
    const setup = await renderTui(
      <StatusBar message="Replaying..." hints={hintsFor()} width={120} />,
      { width: 120, height: 4 }
    );

    const frame = setup.captureCharFrame();
    expect(frame).toContain("Replaying...");
    expect(frame).not.toContain("j/k nav");
  });

  it("shows the filter prompt while the filter bar is open", async () => {
    const setup = await renderTui(<StatusBar filterOpen hints={hintsFor()} width={120} />, {
      width: 120,
      height: 4,
    });

    expect(setup.captureCharFrame()).toContain("Esc close filter");
  });

  it("badges an active filter, the interceptor count and errors", async () => {
    const setup = await renderTui(
      <StatusBar
        filterActive
        interceptorCount={2}
        interceptorErrorCount={1}
        hints={[]}
        width={120}
      />,
      { width: 120, height: 4 }
    );

    const frame = setup.captureCharFrame();
    expect(frame).toContain("[1 error]");
    expect(frame).toContain("[2 interceptors]");
    expect(frame).toContain("[FILTERED]");
  });

  it("uses the singular form for one interceptor", async () => {
    const setup = await renderTui(<StatusBar interceptorCount={1} hints={[]} width={120} />, {
      width: 120,
      height: 4,
    });

    expect(setup.captureCharFrame()).toContain("[1 interceptor]");
  });
});

describe("InfoBar", () => {
  const baseProps = {
    interceptorErrorCount: 0,
    requestCount: 0,
    interceptorCount: 0,
    startTime: Date.now(),
    width: 120,
  };

  it("summarises the session", async () => {
    const setup = await renderTui(
      <InfoBar {...baseProps} requestCount={3} interceptorCount={1} />,
      { width: 120, height: 3 }
    );

    const frame = setup.captureCharFrame();
    expect(frame).toContain("3 requests captured");
    expect(frame).toContain("1 interceptor loaded");
    expect(frame).toContain("uptime: 00:00:00");
  });

  it("uses singular nouns for a single request", async () => {
    const setup = await renderTui(<InfoBar {...baseProps} requestCount={1} />, {
      width: 120,
      height: 3,
    });

    expect(setup.captureCharFrame()).toContain("1 request captured");
  });

  it("replaces the summary with an alert when an interceptor has errors", async () => {
    const setup = await renderTui(
      <InfoBar {...baseProps} requestCount={5} interceptorErrorCount={2} />,
      { width: 120, height: 3 }
    );

    const frame = setup.captureCharFrame();
    expect(frame).toContain("2 interceptor errors");
    expect(frame).toContain("press L to view");
    expect(frame).not.toContain("captured");
  });

  it("renders an empty line when there is nothing to report", async () => {
    const setup = await renderTui(<InfoBar {...baseProps} />, { width: 120, height: 3 });

    expect(setup.captureCharFrame().trim()).toBe("");
  });

  it("counts the uptime up as time passes", async () => {
    const setup = await renderTui(
      <InfoBar {...baseProps} requestCount={1} startTime={Date.now() - 3_725_000} />,
      { width: 120, height: 3 }
    );

    expect(setup.captureCharFrame()).toContain("uptime: 01:02:05");
  });
});
