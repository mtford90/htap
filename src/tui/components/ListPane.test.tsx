/** @jsxImportSource @opentui/react */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStore } from "zustand";
import { ListPane, type ListPaneProps } from "./ListPane.js";
import { createTuiActions, createTuiStore, selectedIndex } from "../store/store.js";
import type { CapturedRequestSummary } from "../../shared/types.js";
import {
  destroyRenderers,
  renderTui,
  settle,
  summary,
  waitForText,
  waitUntil,
} from "../test-support/render.js";

afterEach(destroyRenderers);

const store = () => {
  const tuiStore = createTuiStore({ startTime: 0 });
  return { store: tuiStore, actions: createTuiActions(tuiStore) };
};

type Overrides = Partial<Omit<ListPaneProps, "requests" | "selectedIndex" | "actions">>;

/** Drives ListPane from a real store, so the cursor and the list can move. */
function Harness({
  overrides = {},
  tui,
}: {
  overrides?: Overrides;
  tui: ReturnType<typeof store>;
}): React.ReactNode {
  const requests = useStore(tui.store, (state) => state.requests.items);
  const index = useStore(tui.store, selectedIndex);
  const cursorId = useStore(tui.store, (state) => state.selection.selectedId);
  const following = useStore(tui.store, (state) => state.selection.following);
  const pendingNew = useStore(tui.store, (state) => state.selection.pendingNew);
  return (
    <ListPane
      requests={requests}
      selectedIndex={index}
      cursorId={cursorId}
      actions={tui.actions}
      isActive
      isHovered={false}
      width={100}
      height={12}
      showFullUrl={false}
      following={following}
      pendingNewCount={pendingNew}
      onSelectIndex={vi.fn()}
      onActivate={vi.fn()}
      onHoverChange={vi.fn()}
      {...overrides}
    />
  );
}

const render = async (
  requests: CapturedRequestSummary[],
  overrides: Overrides = {},
  size = { width: 100, height: 14 }
) => {
  const tui = store();
  tui.actions.setRequests(requests);
  const setup = await renderTui(<Harness overrides={overrides} tui={tui} />, size);
  return { ...tui, setup };
};

const manyRequests = (count: number): CapturedRequestSummary[] =>
  Array.from({ length: count }, (_, index) => summary(`r${index}`));

describe("ListPane", () => {
  it("renders one row per request with method, status and duration", async () => {
    const { setup } = await render([summary("a"), summary("b"), summary("c")]);

    const frame = setup.captureCharFrame();
    expect(frame).toContain("[1] Requests");
    expect(frame).toContain("/a");
    expect(frame).toContain("/c");
    expect(frame).toContain("GET");
    expect(frame).toContain("200");
    expect(frame).toContain("12ms");
  });

  it("marks the selected row with a cursor", async () => {
    const { actions, setup } = await render([summary("a"), summary("b"), summary("c")]);

    actions.moveSelectionBy(1);
    await waitUntil(setup, () => {
      const lines = setup.captureCharFrame().split("\n");
      expect(lines[1]).not.toContain("❯");
      expect(lines[2]).toContain("❯");
    });
  });

  it("shows the follow badge while following", async () => {
    const { setup } = await render([summary("a")]);

    expect(setup.captureCharFrame()).toContain("Following");
  });

  it("counts only the new rows still above the viewport", async () => {
    const {
      store: tuiStore,
      actions,
      setup,
    } = await render(
      manyRequests(40),
      { height: 8 },
      {
        width: 100,
        height: 10,
      }
    );
    actions.moveSelectionBy(1);
    await settle(setup);
    actions.setRequests([summary("new-1"), summary("new-2"), ...manyRequests(40)]);
    await settle(setup);

    tuiStore.getState().scrollers.list?.scrollTo(2);

    await waitForText(setup, "2 new");
  });

  it("hides the badge once the new rows are scrolled on screen", async () => {
    const {
      store: tuiStore,
      actions,
      setup,
    } = await render(
      manyRequests(40),
      { height: 8 },
      {
        width: 100,
        height: 10,
      }
    );
    actions.moveSelectionBy(1);
    await settle(setup);
    actions.setRequests([summary("new-1"), ...manyRequests(40)]);
    await waitForText(setup, "1 new");

    tuiStore.getState().scrollers.list?.scrollTo(0);

    await waitUntil(setup, () => expect(setup.captureCharFrame()).not.toContain(" new"));
  });

  it("shows the row range instead of the count once the list overflows", async () => {
    const { store: tuiStore, setup } = await render(
      manyRequests(40),
      { height: 8 },
      {
        width: 100,
        height: 10,
      }
    );

    tuiStore.getState().scrollers.list?.scrollTo(3);

    await waitForText(setup, "4-9/40");
  });

  it("keeps the cursor inside the viewport when it moves past the bottom", async () => {
    const requests = manyRequests(40);
    const { actions, setup } = await render(requests, { height: 8 }, { width: 100, height: 10 });

    actions.moveSelectionBy(20);

    await waitForText(setup, "/r20");
  });

  it("keeps the last row in view when rows arrive while scrolled to the end", async () => {
    const { actions, setup } = await render(
      manyRequests(40),
      { height: 10 },
      {
        width: 100,
        height: 12,
      }
    );
    actions.jumpToLast();
    await waitForText(setup, "33-40/40");

    actions.setRequests([
      ...manyRequests(5).map((r) => summary(`new-${r.id}`)),
      ...manyRequests(40),
    ]);

    await waitForText(setup, "38-45/45");
    expect(setup.captureCharFrame()).toContain("/r39");
    expect(setup.captureCharFrame()).toContain("/r32");
  });

  it("keeps the cursor inside the viewport when it moves back to the top", async () => {
    const requests = manyRequests(40);
    const { actions, setup } = await render(requests, { height: 8 }, { width: 100, height: 10 });
    actions.moveSelectionBy(30);
    await waitForText(setup, "/r30");

    actions.moveSelectionBy(-30);

    await waitForText(setup, "/r0");
  });

  it("renders the empty state with the start-up hint", async () => {
    const { setup } = await render([]);

    const frame = setup.captureCharFrame();
    expect(frame).toContain("No requests captured yet.");
    expect(frame).toContain('eval "$(httap on)"');
  });

  it("shows the full URL when asked", async () => {
    const { setup } = await render([summary("a")], { showFullUrl: true });

    expect(setup.captureCharFrame()).toContain("http://example.test/a");
  });

  it("marks bookmarked and intercepted rows", async () => {
    const { setup } = await render([
      summary("saved", { saved: true }),
      summary("mock", { interceptionType: "mocked" }),
      summary("replayed", { replayedFromId: "origin" }),
    ]);

    const lines = setup.captureCharFrame().split("\n");
    expect(lines[1]).toContain("*");
    expect(lines[2]).toContain("M");
    expect(lines[3]).toContain("R");
  });

  it("reports the index of a clicked row", async () => {
    const onSelectIndex = vi.fn();
    const { setup } = await render(
      manyRequests(20),
      { onSelectIndex, height: 10 },
      {
        width: 100,
        height: 12,
      }
    );

    await setup.mockMouse.click(10, 3);

    expect(onSelectIndex).toHaveBeenCalledWith(2);
  });

  it("leaves follow mode when the wheel scrolls the list", async () => {
    const { store: tuiStore, setup } = await render(
      manyRequests(40),
      { height: 10 },
      {
        width: 100,
        height: 12,
      }
    );

    await setup.mockMouse.scroll(10, 3, "down");

    await waitUntil(setup, () => expect(tuiStore.getState().selection.following).toBe(false));
  });

  it("highlights the search term in the path", async () => {
    const { setup } = await render([summary("alpha-beta")], { searchTerm: "beta" });

    // The row still reads as one path; the highlight is a separate span.
    expect(setup.captureCharFrame()).toContain("/alpha-beta");
    const row = setup.captureSpans().lines[1]?.spans.map((span) => span.text) ?? [];
    expect(row.some((text) => text === "beta")).toBe(true);
  });
});
