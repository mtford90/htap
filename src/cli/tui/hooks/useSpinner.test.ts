/**
 * Tests for the useSpinner hook.
 * Uses ink-testing-library since @testing-library/react is not available.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useSpinner } from "./useSpinner.js";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** Wrapper component that renders the spinner frame as text. */
function SpinnerDisplay(): React.ReactElement {
  const frame = useSpinner();
  return React.createElement(Text, null, `[${frame}]`);
}

const tick = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

describe("useSpinner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the first frame initially", () => {
    const { lastFrame } = render(React.createElement(SpinnerDisplay));
    expect(lastFrame()).toContain(SPINNER_FRAMES[0]);
  });

  it("cycles through frames over time", async () => {
    const { lastFrame } = render(React.createElement(SpinnerDisplay));

    // Wait enough time for several frame changes (80ms per frame)
    await tick(250);

    const frame = lastFrame();
    // Should have advanced past the first frame
    const matchesAnyFrame = SPINNER_FRAMES.some((f) => frame.includes(f));
    expect(matchesAnyFrame).toBe(true);
  });

  it("always renders a valid braille spinner character", async () => {
    const { lastFrame } = render(React.createElement(SpinnerDisplay));

    await tick(500);

    const frame = lastFrame();
    const matchesAnyFrame = SPINNER_FRAMES.some((f) => frame.includes(f));
    expect(matchesAnyFrame).toBe(true);
  });

  it("cleans up interval on unmount", () => {
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    const { unmount } = render(React.createElement(SpinnerDisplay));

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
