import { describe, expect, it } from "vitest";
import type { CapturedRequestSummary } from "../../shared/types.js";
import {
  createTuiActions,
  createTuiStore,
  selectedIndex,
  selectedSummary,
  DEFAULT_LIST_RATIO,
  MAX_LIST_RATIO,
  MIN_LIST_RATIO,
} from "./store.js";
import {
  SECTION_REQUEST,
  SECTION_REQUEST_BODY,
  SECTION_RESPONSE_BODY,
  type TuiState,
} from "./types.js";

const summary = (id: string, overrides: Partial<CapturedRequestSummary> = {}) =>
  ({
    id,
    sessionId: "session",
    timestamp: 1000,
    method: "GET",
    url: `https://example.test/${id}`,
    host: "example.test",
    path: `/${id}`,
    requestBodySize: 0,
    responseBodySize: 0,
    ...overrides,
  }) satisfies CapturedRequestSummary;

const setup = (ids: string[] = [], listHeight = 5) => {
  const store = createTuiStore({ startTime: 0 });
  const actions = createTuiActions(store);
  actions.setViewport({ columns: 120, rows: 40, contentHeight: listHeight + 2, listHeight });
  if (ids.length > 0) {
    actions.setRequests(ids.map((id) => summary(id)));
  }
  return { store, actions };
};

const ids = (state: TuiState): string[] => state.requests.items.map((item) => item.id);

describe("selection", () => {
  it("starts in follow mode with the newest request selected", () => {
    const { store } = setup(["c", "b", "a"]);
    const state = store.getState();

    expect(state.selection.following).toBe(true);
    expect(selectedIndex(state)).toBe(0);
    expect(selectedSummary(state)?.id).toBe("c");
  });

  it("moving the cursor leaves follow mode", () => {
    const { store, actions } = setup(["c", "b", "a"]);

    actions.moveSelectionBy(1);

    const state = store.getState();
    expect(state.selection.following).toBe(false);
    expect(state.selection.selectedId).toBe("b");
  });

  it("clamps cursor movement at both ends", () => {
    const { store, actions } = setup(["c", "b", "a"]);

    actions.moveSelectionBy(-5);
    expect(store.getState().selection.selectedId).toBe("c");

    actions.moveSelectionBy(99);
    expect(store.getState().selection.selectedId).toBe("a");
  });

  it("does nothing when the list is empty", () => {
    const { store, actions } = setup([]);

    actions.moveSelectionBy(1);

    expect(store.getState().selection.selectedId).toBeNull();
    expect(store.getState().selection.following).toBe(true);
  });

  it("jumps to the last row", () => {
    const { store, actions } = setup(["a", "b", "c", "d", "e", "f", "g"], 3);

    actions.jumpToLast();

    expect(store.getState().selection.selectedId).toBe("g");
  });

  it("g returns to follow mode and clears the pending count", () => {
    const { store, actions } = setup(["b", "a"]);
    actions.moveSelectionBy(1);
    actions.setRequests([summary("c"), summary("b"), summary("a")]);
    expect(store.getState().selection.pendingNew).toBe(1);

    actions.resetToFollow();

    const state = store.getState();
    expect(state.selection.following).toBe(true);
    expect(state.selection.selectedId).toBeNull();
    expect(state.selection.pendingNew).toBe(0);
  });

  it("toggles follow off onto the current row and back on", () => {
    const { store, actions } = setup(["c", "b", "a"]);

    actions.toggleFollow();
    expect(store.getState().selection).toMatchObject({ following: false, selectedId: "c" });

    actions.toggleFollow();
    expect(store.getState().selection).toMatchObject({ following: true, selectedId: null });
  });

  it("selects a row by index and focuses the list", () => {
    const { store, actions } = setup(["c", "b", "a"]);
    actions.setActivePanel("detail");

    actions.selectIndex(2);

    expect(store.getState().selection).toMatchObject({
      selectedId: "a",
      activePanel: "list",
      following: false,
    });
  });

  it("ignores a click on an index that is out of range", () => {
    const { store, actions } = setup(["c", "b", "a"]);

    actions.selectIndex(9);

    expect(store.getState().selection.following).toBe(true);
  });
});

describe("leaving follow mode", () => {
  it("leaves the cursor unpinned when the wheel scrolls the list", () => {
    const { store, actions } = setup(["a", "b", "c", "d", "e", "f"], 3);

    actions.stopFollowing();

    const state = store.getState();
    expect(state.selection.following).toBe(false);
    expect(state.selection.selectedId).toBeNull();
  });

  it("leaves an existing selection alone", () => {
    const { store, actions } = setup(["a", "b", "c"], 3);
    actions.moveSelectionBy(1);

    actions.stopFollowing();

    expect(store.getState().selection.selectedId).toBe("b");
  });
});

describe("applying a new request list", () => {
  it("counts rows prepended while browsing", () => {
    const { store, actions } = setup(["b", "a"]);
    actions.moveSelectionBy(1);

    actions.setRequests([summary("d"), summary("c"), summary("b"), summary("a")]);

    expect(store.getState().selection.pendingNew).toBe(2);
    expect(store.getState().selection.selectedId).toBe("a");
  });

  it("keeps the pending count at zero while following", () => {
    const { store, actions } = setup(["a"]);

    actions.setRequests([summary("b"), summary("a")]);

    expect(store.getState().selection.pendingNew).toBe(0);
    expect(selectedSummary(store.getState())?.id).toBe("b");
  });

  it("re-anchors the selection when the selected row disappears", () => {
    const { store, actions } = setup(["c", "b", "a"]);
    actions.moveSelectionBy(1);

    actions.setRequests([summary("c"), summary("a")]);

    expect(store.getState().selection.selectedId).toBe("c");
  });

  it("clears the selection when every row disappears", () => {
    const { store, actions } = setup(["c", "b"]);
    actions.moveSelectionBy(1);

    actions.setRequests([]);

    expect(store.getState().selection.selectedId).toBeNull();
    expect(ids(store.getState())).toEqual([]);
  });

  it("clears the loading and error flags", () => {
    const { store, actions } = setup();
    actions.setError("boom");

    actions.setRequests([summary("a")]);

    expect(store.getState().requests).toMatchObject({ loading: false, error: null });
  });
});

describe("panels and sections", () => {
  it("Tab does nothing until a request is loaded", () => {
    const { store, actions } = setup(["a"]);

    actions.cycleFocus(false);

    expect(store.getState().selection.activePanel).toBe("list");
  });

  it("Tab walks the list, each section, then back to the list", () => {
    const { store, actions } = setup(["a"]);
    actions.setDetail("a", { id: "a" } as never);

    const seen: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      actions.cycleFocus(false);
      const { activePanel, focusedSection } = store.getState().selection;
      seen.push(activePanel === "list" ? "list" : `detail:${focusedSection}`);
    }

    expect(seen).toEqual(["detail:0", "detail:1", "detail:2", "detail:3", "list"]);
  });

  it("Shift+Tab walks backwards from the last section to the list", () => {
    const { store, actions } = setup(["a"]);
    actions.setDetail("a", { id: "a" } as never);

    actions.cycleFocus(true);
    expect(store.getState().selection).toMatchObject({
      activePanel: "detail",
      focusedSection: SECTION_RESPONSE_BODY,
    });

    actions.cycleFocus(true);
    expect(store.getState().selection.focusedSection).toBe(2);
  });

  it("clamps section movement to the four sections", () => {
    const { store, actions } = setup(["a"]);
    actions.focusSection(SECTION_REQUEST);

    actions.moveSectionBy(-1);
    expect(store.getState().selection.focusedSection).toBe(SECTION_REQUEST);

    actions.moveSectionBy(99);
    expect(store.getState().selection.focusedSection).toBe(SECTION_RESPONSE_BODY);
  });

  it("toggles one section without touching the others", () => {
    const { store, actions } = setup(["a"]);

    actions.toggleSection(SECTION_REQUEST_BODY);

    const expanded = store.getState().selection.expandedSections;
    expect(expanded.has(SECTION_REQUEST_BODY)).toBe(false);
    expect(expanded.has(SECTION_REQUEST)).toBe(true);

    actions.toggleSection(SECTION_REQUEST_BODY);
    expect(store.getState().selection.expandedSections.has(SECTION_REQUEST_BODY)).toBe(true);
  });

  it("closes a request-backed modal when the detail request disappears", () => {
    const { store, actions } = setup(["a"]);
    actions.setDetail("a", { id: "a" } as never);
    actions.openModal({ kind: "bodyExport", bodyType: "response" });

    actions.setDetail(null, null);

    expect(store.getState().ui.modal).toBeNull();
  });

  it("keeps a request-independent modal open when the detail request disappears", () => {
    const { store, actions } = setup(["a"]);
    actions.setDetail("a", { id: "a" } as never);
    actions.openModal({ kind: "help" });

    actions.setDetail(null, null);

    expect(store.getState().ui.modal).toEqual({ kind: "help" });
  });

  it("re-expands every section when the detail request changes", () => {
    const { store, actions } = setup(["a"]);
    actions.setDetail("a", { id: "a" } as never);
    actions.toggleSection(SECTION_REQUEST);

    actions.setDetail("b", { id: "b" } as never);

    expect(store.getState().selection.expandedSections.has(SECTION_REQUEST)).toBe(true);
  });
});

describe("layout", () => {
  it("clamps the list width ratio", () => {
    const { store, actions } = setup();

    for (let i = 0; i < 50; i += 1) {
      actions.resizeListBy(-0.05);
    }
    expect(store.getState().ui.listWidthRatio).toBeCloseTo(MIN_LIST_RATIO);

    for (let i = 0; i < 50; i += 1) {
      actions.resizeListBy(0.05);
    }
    expect(store.getState().ui.listWidthRatio).toBeCloseTo(MAX_LIST_RATIO);

    actions.resetListWidth();
    expect(store.getState().ui.listWidthRatio).toBe(DEFAULT_LIST_RATIO);
  });
});

describe("ui state", () => {
  it("toggleFullUrl returns the value it just stored", () => {
    const { store, actions } = setup();

    expect(actions.toggleFullUrl()).toBe(true);
    expect(store.getState().ui.showFullUrl).toBe(true);
    expect(actions.toggleFullUrl()).toBe(false);
  });

  it("holds at most one modal at a time", () => {
    const { store, actions } = setup();

    actions.openModal({ kind: "help" });
    actions.openModal({ kind: "interceptorLog" });

    expect(store.getState().ui.modal).toEqual({ kind: "interceptorLog" });

    actions.closeModal();
    expect(store.getState().ui.modal).toBeNull();
  });
});
