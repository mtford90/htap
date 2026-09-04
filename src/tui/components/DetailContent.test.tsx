/** @jsxImportSource @opentui/react */

import React from "react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { useKeyboard } from "@opentui/react";
import { destroyRenderers, renderTui, waitForText } from "../test-support/render.js";
import { highlightCode } from "../utils/syntax-highlight.js";

vi.mock("../utils/syntax-highlight.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/syntax-highlight.js")>();
  return { ...actual, highlightCode: vi.fn(actual.highlightCode) };
});

const { BodyContent } = await import("./DetailContent.js");

afterEach(() => {
  destroyRenderers();
  vi.mocked(highlightCode).mockClear();
});

const body = Buffer.from(JSON.stringify({ hello: "world", items: [1, 2, 3] }));

/** Re-renders the body on every key press so unrelated updates are observable. */
function Harness(): React.ReactNode {
  const [tick, setTick] = React.useState(0);
  useKeyboard(() => setTick((current) => current + 1));
  return (
    <box flexDirection="column">
      <text>{`tick ${tick}`}</text>
      <BodyContent body={body} contentType="application/json" maxLines={20} />
    </box>
  );
}

describe("BodyContent", () => {
  it("shows the pretty-printed body", async () => {
    const setup = await renderTui(<Harness />, { width: 60, height: 20 });

    await waitForText(setup, "hello");
  });

  it("highlights once across unrelated re-renders", async () => {
    const setup = await renderTui(<Harness />, { width: 60, height: 20 });
    await waitForText(setup, "tick 0");
    const callsAfterMount = (highlightCode as Mock).mock.calls.length;

    await setup.mockInput.typeText("x");
    await waitForText(setup, "tick 1");

    expect(callsAfterMount).toBe(1);
    expect((highlightCode as Mock).mock.calls.length).toBe(callsAfterMount);
  });
});
