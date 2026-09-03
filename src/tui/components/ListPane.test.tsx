/** @jsxImportSource @opentui/react */

import { afterEach, describe, expect, it, vi } from "vitest";
import { ListPane, type ListPaneProps } from "./ListPane.js";
import { destroyRenderers, renderTui, summary } from "../test-support/render.js";

afterEach(destroyRenderers);

const props = (overrides: Partial<ListPaneProps> = {}): ListPaneProps => ({
  requests: [summary("a"), summary("b"), summary("c")],
  selectedIndex: 0,
  scrollOffset: 0,
  isActive: true,
  isHovered: false,
  width: 100,
  height: 12,
  showFullUrl: false,
  following: true,
  pendingNewCount: 0,
  onSelectIndex: vi.fn(),
  onScroll: vi.fn(),
  onActivate: vi.fn(),
  onHoverChange: vi.fn(),
  ...overrides,
});

describe("ListPane", () => {
  it("renders one row per request with method, status and duration", async () => {
    const setup = await renderTui(<ListPane {...props()} />, { width: 100, height: 14 });

    const frame = setup.captureCharFrame();
    expect(frame).toContain("[1] Requests");
    expect(frame).toContain("/a");
    expect(frame).toContain("/c");
    expect(frame).toContain("GET");
    expect(frame).toContain("200");
    expect(frame).toContain("12ms");
  });

  it("marks the selected row with a cursor", async () => {
    const setup = await renderTui(<ListPane {...props({ selectedIndex: 1 })} />, {
      width: 100,
      height: 14,
    });

    const lines = setup.captureCharFrame().split("\n");
    expect(lines[1]).not.toContain("❯");
    expect(lines[2]).toContain("❯");
  });

  it("shows the follow badge while following", async () => {
    const setup = await renderTui(<ListPane {...props()} />, { width: 100, height: 14 });

    expect(setup.captureCharFrame()).toContain("Following");
  });

  it("counts only the new rows still above the viewport", async () => {
    const setup = await renderTui(
      <ListPane {...props({ following: false, pendingNewCount: 5, scrollOffset: 2 })} />,
      { width: 100, height: 14 }
    );

    expect(setup.captureCharFrame()).toContain("2 new");
  });

  it("hides the badge once the new rows have been scrolled past", async () => {
    const setup = await renderTui(
      <ListPane {...props({ following: false, pendingNewCount: 3, scrollOffset: 0 })} />,
      { width: 100, height: 14 }
    );

    expect(setup.captureCharFrame()).not.toContain("new");
  });

  it("shows the row range instead of the count once the list overflows", async () => {
    const requests = Array.from({ length: 40 }, (_, index) => summary(`r${index}`));
    const setup = await renderTui(
      <ListPane {...props({ requests, scrollOffset: 3, height: 8 })} />,
      { width: 100, height: 10 }
    );

    expect(setup.captureCharFrame()).toContain("4-9/40");
  });

  it("renders the empty state with the start-up hint", async () => {
    const setup = await renderTui(<ListPane {...props({ requests: [] })} />, {
      width: 100,
      height: 14,
    });

    const frame = setup.captureCharFrame();
    expect(frame).toContain("No requests captured yet.");
    expect(frame).toContain('eval "$(httap on)"');
  });

  it("shows the full URL when asked", async () => {
    const setup = await renderTui(<ListPane {...props({ showFullUrl: true })} />, {
      width: 100,
      height: 14,
    });

    expect(setup.captureCharFrame()).toContain("http://example.test/a");
  });

  it("marks bookmarked and intercepted rows", async () => {
    const requests = [
      summary("saved", { saved: true }),
      summary("mock", { interceptionType: "mocked" }),
      summary("replayed", { replayedFromId: "origin" }),
    ];
    const setup = await renderTui(<ListPane {...props({ requests, selectedIndex: -1 })} />, {
      width: 100,
      height: 14,
    });

    const lines = setup.captureCharFrame().split("\n");
    expect(lines[1]).toContain("*");
    expect(lines[2]).toContain("M");
    expect(lines[3]).toContain("R");
  });

  it("reports the absolute index of a clicked row", async () => {
    const onSelectIndex = vi.fn();
    const requests = Array.from({ length: 20 }, (_, index) => summary(`r${index}`));
    const setup = await renderTui(
      <ListPane {...props({ requests, scrollOffset: 5, onSelectIndex, height: 10 })} />,
      { width: 100, height: 12 }
    );

    await setup.mockMouse.click(10, 3);

    expect(onSelectIndex).toHaveBeenCalledWith(7);
  });

  it("reports wheel scrolling in both directions", async () => {
    const onScroll = vi.fn();
    const setup = await renderTui(<ListPane {...props({ onScroll })} />, {
      width: 100,
      height: 12,
    });

    await setup.mockMouse.scroll(10, 3, "down");
    await setup.mockMouse.scroll(10, 3, "up");

    expect(onScroll).toHaveBeenNthCalledWith(1, 1);
    expect(onScroll).toHaveBeenNthCalledWith(2, -1);
  });

  it("highlights the search term in the path", async () => {
    const setup = await renderTui(
      <ListPane {...props({ requests: [summary("alpha-beta")], searchTerm: "beta" })} />,
      { width: 100, height: 12 }
    );

    // The row still reads as one path; the highlight is a separate span.
    expect(setup.captureCharFrame()).toContain("/alpha-beta");
    const row = setup.captureSpans().lines[1]?.spans.map((span) => span.text) ?? [];
    expect(row.some((text) => text === "beta")).toBe(true);
  });
});
