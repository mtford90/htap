/** @jsxImportSource @opentui/react */

import React from "react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { useKeyboard } from "@opentui/react";
import { destroyRenderers, renderTui, waitForText, waitUntil } from "../test-support/render.js";
import { highlightCode } from "../utils/syntax-highlight.js";

/** Stands in for the real deferred load, which can only happen once per process. */
let highlighterVersion = 0;
const highlighterListeners = new Set<() => void>();
const landHighlighter = (): void => {
  highlighterVersion += 1;
  for (const listener of highlighterListeners) {
    listener();
  }
};

vi.mock("../utils/syntax-highlight.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/syntax-highlight.js")>();
  return {
    ...actual,
    highlightCode: vi.fn(actual.highlightCode),
    getHighlighterVersion: () => highlighterVersion,
    subscribeToHighlighter: (listener: () => void) => {
      highlighterListeners.add(listener);
      return () => {
        highlighterListeners.delete(listener);
      };
    },
  };
});

const { BodyContent, bodyDisplayLines } = await import("./DetailContent.js");

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

  it("re-highlights the body once the deferred highlighter lands", async () => {
    const setup = await renderTui(<Harness />, { width: 60, height: 20 });
    await waitForText(setup, "tick 0");
    const callsAfterMount = (highlightCode as Mock).mock.calls.length;

    landHighlighter();

    await waitUntil(setup, () =>
      expect((highlightCode as Mock).mock.calls.length).toBe(callsAfterMount + 1)
    );
  });
});

describe("bodyDisplayLines", () => {
  const linesOf = (count: number): Buffer =>
    Buffer.from(Array.from({ length: count }, (_, index) => `line ${index}`).join("\n"));

  it("highlights only the lines the pane can show", () => {
    bodyDisplayLines(linesOf(500), "text/plain", 20);

    const highlighted = vi.mocked(highlightCode).mock.calls[0]?.[0] ?? "";
    expect(highlighted.split("\n")).toHaveLength(20);
  });

  it("counts the whole body so the footer reports the real remainder", () => {
    const { lines, totalLines } = bodyDisplayLines(linesOf(500), "text/plain", 20);

    expect(lines).toHaveLength(20);
    expect(totalLines).toBe(500);
  });

  it("clips a single enormous line instead of highlighting all of it", () => {
    const body = Buffer.from("x".repeat(40 * 1024));

    const { lines, totalLines } = bodyDisplayLines(body, "text/plain", 20);

    const highlighted = vi.mocked(highlightCode).mock.calls[0]?.[0] ?? "";
    expect(highlighted).toHaveLength(512);
    expect(lines[0]?.[0]?.text).toHaveLength(512);
    expect(totalLines).toBe(2);
  });

  it("marks a body cut at the preview limit and counts the marker", () => {
    // 2,000 lines of 10 bytes, so only the first 1,024 survive the 10 KB limit.
    const body = Buffer.from(Array.from({ length: 2000 }, () => "123456789").join("\n"));

    const { lines, totalLines } = bodyDisplayLines(body, "text/plain", 20);

    expect(totalLines).toBe(1026);
    expect(lines.at(-1)?.[0]?.text).toBe("... truncated (19.5KB total)");
  });

  it("pretty-prints JSON before it picks the window", () => {
    const body = Buffer.from(JSON.stringify({ a: 1, b: 2, c: 3 }));

    const { lines, totalLines } = bodyDisplayLines(body, "application/json", 20);

    expect(totalLines).toBe(5);
    expect(lines[1]?.map((segment) => segment.text).join("")).toBe(`  "a": 1,`);
  });
});
