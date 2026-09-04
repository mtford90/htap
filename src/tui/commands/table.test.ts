import { describe, expect, it, vi } from "vitest";
import type { CapturedRequest, CapturedRequestSummary } from "../../shared/types.js";
import { createTuiActions, createTuiStore, selectedSummary } from "../store/store.js";
import { SECTION_REQUEST_BODY, SECTION_RESPONSE_BODY } from "../store/types.js";
import { SyncEngine, type SyncClient } from "../sync/engine.js";
import { COMMANDS, dispatchKey, visibleHints, type CommandDeps } from "./table.js";
import type { KeyLike } from "./keys.js";

const key = (sequence: string, overrides: Partial<KeyLike> = {}): KeyLike => ({
  name: sequence,
  sequence,
  ctrl: false,
  shift: false,
  meta: false,
  ...overrides,
});

const named = (name: string, overrides: Partial<KeyLike> = {}): KeyLike =>
  key(name, { name, sequence: "", ...overrides });

const summary = (id: string, overrides: Partial<CapturedRequestSummary> = {}) =>
  ({
    id,
    sessionId: "session",
    timestamp: 1,
    method: "GET",
    url: `https://example.test/${id}`,
    host: "example.test",
    path: `/${id}`,
    requestBodySize: 0,
    responseBodySize: 0,
    ...overrides,
  }) satisfies CapturedRequestSummary;

const detail = (overrides: Partial<CapturedRequest> = {}): CapturedRequest => ({
  id: "a",
  sessionId: "session",
  timestamp: 1,
  method: "GET",
  url: "https://example.test/a",
  host: "example.test",
  path: "/a",
  requestHeaders: {},
  ...overrides,
});

const stubClient = (overrides: Partial<SyncClient> = {}): SyncClient => ({
  listRequestsSummaryDelta: vi.fn(async () => ({ entries: [], cursor: 0, hasMore: false })),
  searchBodies: vi.fn(async () => []),
  getRequest: vi.fn(async () => null),
  replayRequest: vi.fn(async () => ({ requestId: "new-id" })),
  saveRequest: vi.fn(async () => ({ success: true })),
  unsaveRequest: vi.fn(async () => ({ success: true })),
  clearRequests: vi.fn(async () => undefined),
  getInterceptorEvents: vi.fn(async () => ({
    events: [],
    counts: { info: 0, warn: 0, error: 0 },
  })),
  status: vi.fn(async () => ({})),
  close: vi.fn(),
  ...overrides,
});

const setup = (options: { ids?: string[]; client?: Partial<SyncClient> } = {}) => {
  const store = createTuiStore({ startTime: 0 });
  const actions = createTuiActions(store);
  actions.setViewport({ columns: 120, rows: 40, contentHeight: 10, listHeight: 8 });
  if (options.ids) {
    actions.setRequests(options.ids.map((id) => summary(id)));
  }

  const client = stubClient(options.client);
  const engine = new SyncEngine({ client, actions });
  const deps: CommandDeps = {
    store,
    actions,
    engine,
    showStatus: vi.fn(),
    exit: vi.fn(),
    copyToClipboard: vi.fn(async () => undefined),
  };
  return { store, actions, engine, client, deps };
};

describe("dispatch", () => {
  it("moves the list cursor with j and k", () => {
    const { store, deps } = setup({ ids: ["c", "b", "a"] });

    expect(dispatchKey(deps, key("j"))).toBe(true);
    expect(store.getState().selection.selectedId).toBe("b");

    dispatchKey(deps, key("k"));
    expect(store.getState().selection.selectedId).toBe("c");
  });

  it("accepts the arrow keys as aliases for j and k", () => {
    const { store, deps } = setup({ ids: ["c", "b", "a"] });

    dispatchKey(deps, named("down"));

    expect(store.getState().selection.selectedId).toBe("b");
  });

  it("moves the section focus when the detail pane is active", () => {
    const { store, actions, deps } = setup({ ids: ["a"] });
    actions.setDetail("a", detail());
    actions.focusSection(0);

    dispatchKey(deps, key("j"));

    expect(store.getState().selection.focusedSection).toBe(1);
  });

  it("the page keys do nothing while the detail pane is focused", () => {
    const { store, actions, deps } = setup({ ids: ["c", "b", "a"] });
    actions.setDetail("a", detail());
    actions.focusSection(0);

    dispatchKey(deps, named("d", { ctrl: true }));

    expect(store.getState().selection.focusedSection).toBe(0);
    expect(store.getState().selection.selectedId).toBeNull();
  });

  it("Ctrl+d moves half a page and Ctrl+f a full page", () => {
    const rows = Array.from({ length: 40 }, (_, i) => `r${i}`);
    const { store, deps } = setup({ ids: rows });

    dispatchKey(deps, named("d", { ctrl: true }));
    expect(store.getState().selection.selectedId).toBe("r5");

    dispatchKey(deps, named("f", { ctrl: true }));
    expect(store.getState().selection.selectedId).toBe("r15");
  });

  it("number keys jump straight to a panel", () => {
    const { store, deps } = setup({ ids: ["a"] });

    dispatchKey(deps, key("4"));
    expect(store.getState().selection).toMatchObject({ activePanel: "detail", focusedSection: 2 });

    dispatchKey(deps, key("1"));
    expect(store.getState().selection.activePanel).toBe("list");
  });

  it("u toggles the URL column and reports which mode is on", () => {
    const { store, deps } = setup({ ids: ["a"] });

    dispatchKey(deps, key("u"));

    expect(store.getState().ui.showFullUrl).toBe(true);
    expect(deps.showStatus).toHaveBeenCalledWith("Showing full URL");
  });

  it("q exits", () => {
    const { deps } = setup();

    dispatchKey(deps, key("q"));

    expect(deps.exit).toHaveBeenCalled();
  });

  it("ctrl+c exits", () => {
    const { deps } = setup({ ids: ["a"] });

    expect(dispatchKey(deps, named("c", { ctrl: true }))).toBe(true);

    expect(deps.exit).toHaveBeenCalled();
  });

  it("ctrl+c exits even with a modal open", () => {
    const { actions, deps } = setup({ ids: ["a"] });
    actions.openModal({ kind: "help" });

    expect(dispatchKey(deps, named("c", { ctrl: true }))).toBe(true);

    expect(deps.exit).toHaveBeenCalled();
  });

  it("ctrl+c exits even with the filter bar open", () => {
    const { actions, deps } = setup({ ids: ["a"] });
    actions.setFilterOpen(true);

    dispatchKey(deps, named("c", { ctrl: true }));

    expect(deps.exit).toHaveBeenCalled();
  });

  it("/ opens the filter bar", () => {
    const { store, deps } = setup();

    dispatchKey(deps, key("/"));

    expect(store.getState().ui.filterOpen).toBe(true);
  });

  it("? opens help and L opens the interceptor log", () => {
    const { store, actions, deps } = setup();

    dispatchKey(deps, key("?"));
    expect(store.getState().ui.modal).toEqual({ kind: "help" });

    actions.closeModal();
    dispatchKey(deps, key("L"));
    expect(store.getState().ui.modal).toEqual({ kind: "interceptorLog" });
  });

  it("ignores unbound keys", () => {
    const { deps } = setup({ ids: ["a"] });

    expect(dispatchKey(deps, key("Z"))).toBe(false);
  });

  it("hands every key to the modal while one is open", () => {
    const { store, actions, deps } = setup({ ids: ["c", "b"] });
    actions.openModal({ kind: "help" });

    expect(dispatchKey(deps, key("j"))).toBe(false);
    expect(store.getState().selection.selectedId).toBeNull();
  });

  it("hands every key to the filter bar while it is open", () => {
    const { store, actions, deps } = setup({ ids: ["c", "b"] });
    actions.setFilterOpen(true);

    expect(dispatchKey(deps, key("j"))).toBe(false);
    expect(store.getState().selection.selectedId).toBeNull();
  });
});

describe("confirmations", () => {
  it("x asks before clearing and y clears", async () => {
    const { store, deps, client } = setup({ ids: ["a"] });

    dispatchKey(deps, key("x"));
    expect(store.getState().ui.confirm).toEqual({ kind: "clear" });

    dispatchKey(deps, key("y"));
    await vi.waitFor(() => expect(client.clearRequests).toHaveBeenCalled());
    expect(store.getState().ui.confirm).toBeNull();
  });

  it("any other key cancels the clear", () => {
    const { store, deps, client } = setup({ ids: ["a"] });
    dispatchKey(deps, key("x"));

    dispatchKey(deps, key("n"));

    expect(client.clearRequests).not.toHaveBeenCalled();
    expect(store.getState().ui.confirm).toBeNull();
    expect(store.getState().ui.statusMessage).toBeUndefined();
  });

  it("refuses to clear an empty list", () => {
    const { store, deps } = setup({ ids: [] });

    dispatchKey(deps, key("x"));

    expect(store.getState().ui.confirm).toBeNull();
    expect(deps.showStatus).toHaveBeenCalledWith("No requests to clear");
  });

  it("R asks before replaying and y replays the selected request", async () => {
    const { store, deps, client } = setup({ ids: ["c", "b"] });

    dispatchKey(deps, key("R"));
    expect(store.getState().ui.confirm).toEqual({ kind: "replay", requestId: "c" });

    dispatchKey(deps, key("y"));
    await vi.waitFor(() => expect(client.replayRequest).toHaveBeenCalled());
    expect(client.replayRequest).toHaveBeenCalledWith({ id: "c", initiator: "tui" });
  });

  it("reports a failed replay", async () => {
    const { deps } = setup({
      ids: ["c"],
      client: { replayRequest: vi.fn(() => Promise.reject(new Error("upstream refused"))) },
    });

    dispatchKey(deps, key("R"));
    dispatchKey(deps, key("y"));

    await vi.waitFor(() =>
      expect(deps.showStatus).toHaveBeenCalledWith("Failed to replay: upstream refused")
    );
  });

  it("R with nothing selected says so", () => {
    const { store, deps } = setup({ ids: [] });

    dispatchKey(deps, key("R"));

    expect(store.getState().ui.confirm).toBeNull();
    expect(deps.showStatus).toHaveBeenCalledWith("No request selected");
  });
});

describe("bookmarks", () => {
  it("b bookmarks the selected request", async () => {
    const { deps, client } = setup({ ids: ["c"] });

    dispatchKey(deps, key("b"));

    await vi.waitFor(() => expect(client.saveRequest).toHaveBeenCalledWith("c"));
    await vi.waitFor(() => expect(deps.showStatus).toHaveBeenCalledWith("Bookmarked"));
  });

  it("b removes an existing bookmark", async () => {
    const { actions, deps, client } = setup();
    actions.setRequests([summary("c", { saved: true })]);

    dispatchKey(deps, key("b"));

    await vi.waitFor(() => expect(client.unsaveRequest).toHaveBeenCalledWith("c"));
    await vi.waitFor(() => expect(deps.showStatus).toHaveBeenCalledWith("Bookmark removed"));
  });
});

describe("body commands", () => {
  const jsonRequest = detail({
    responseHeaders: { "content-type": "application/json" },
    responseBody: Buffer.from('{"ok":true}'),
  });

  const focusResponseBody = (setupResult: ReturnType<typeof setup>) => {
    setupResult.actions.setDetail("a", jsonRequest);
    setupResult.actions.focusSection(SECTION_RESPONSE_BODY);
  };

  it("Enter opens the JSON explorer for a JSON body", () => {
    const result = setup({ ids: ["a"] });
    focusResponseBody(result);

    dispatchKey(result.deps, named("return"));

    expect(result.store.getState().ui.modal).toMatchObject({
      kind: "json",
      title: "Response Body",
      data: { ok: true },
    });
  });

  it("Enter falls back to the text viewer for malformed JSON", () => {
    const result = setup({ ids: ["a"] });
    result.actions.setDetail(
      "a",
      detail({
        responseHeaders: { "content-type": "application/json" },
        responseBody: Buffer.from("{oops"),
      })
    );
    result.actions.focusSection(SECTION_RESPONSE_BODY);

    dispatchKey(result.deps, named("return"));

    expect(result.store.getState().ui.modal).toMatchObject({ kind: "text", text: "{oops" });
  });

  it("Enter does nothing on a header section", () => {
    const result = setup({ ids: ["a"] });
    result.actions.setDetail("a", jsonRequest);
    result.actions.focusSection(0);

    dispatchKey(result.deps, named("return"));

    expect(result.store.getState().ui.modal).toBeNull();
  });

  it("y copies the focused body", async () => {
    const result = setup({ ids: ["a"] });
    focusResponseBody(result);

    dispatchKey(result.deps, key("y"));

    expect(result.deps.copyToClipboard).toHaveBeenCalledWith('{"ok":true}');
    await vi.waitFor(() =>
      expect(result.deps.showStatus).toHaveBeenCalledWith("Body copied to clipboard")
    );
  });

  it("y refuses to copy binary content", () => {
    const result = setup({ ids: ["a"] });
    result.actions.setDetail(
      "a",
      detail({
        responseHeaders: { "content-type": "image/png" },
        responseBody: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]),
      })
    );
    result.actions.focusSection(SECTION_RESPONSE_BODY);

    dispatchKey(result.deps, key("y"));

    expect(result.deps.copyToClipboard).not.toHaveBeenCalled();
    expect(result.deps.showStatus).toHaveBeenCalledWith(
      "Cannot copy binary content — use 's' to export"
    );
  });

  it("s opens the export modal for the focused body", () => {
    const result = setup({ ids: ["a"] });
    result.actions.setDetail(
      "a",
      detail({
        requestHeaders: { "content-type": "text/plain" },
        requestBody: Buffer.from("hello"),
      })
    );
    result.actions.focusSection(SECTION_REQUEST_BODY);

    dispatchKey(result.deps, key("s"));

    expect(result.store.getState().ui.modal).toEqual({ kind: "bodyExport", bodyType: "request" });
  });

  it("s reports an empty body", () => {
    const result = setup({ ids: ["a"] });
    result.actions.setDetail("a", detail());
    result.actions.focusSection(SECTION_REQUEST_BODY);

    dispatchKey(result.deps, key("s"));

    expect(result.store.getState().ui.modal).toBeNull();
    expect(result.deps.showStatus).toHaveBeenCalledWith("No body to export");
  });

  it("e opens the format export modal only with a request loaded", () => {
    const result = setup({ ids: ["a"] });

    dispatchKey(result.deps, key("e"));
    expect(result.deps.showStatus).toHaveBeenCalledWith("No request selected");

    result.actions.setDetail("a", detail());
    dispatchKey(result.deps, key("e"));
    expect(result.store.getState().ui.modal).toEqual({ kind: "formatExport" });
  });
});

describe("hints", () => {
  it("shows only the unconditional hints on an empty list", () => {
    const { store } = setup();

    expect(visibleHints(store.getState()).map((hint) => hint.key)).toEqual([
      "j/k",
      "Tab",
      "u",
      "/",
      "?",
      "q",
    ]);
  });

  it("adds the selection hints once a request is open", () => {
    const { store, actions } = setup({ ids: ["a"] });
    actions.setDetail("a", detail());

    const keys = visibleHints(store.getState()).map((hint) => hint.key);

    expect(keys).toContain("Space");
    expect(keys).toContain("R");
    expect(keys).toContain("F");
    expect(keys).toContain("x");
  });

  it("every hint belongs to a command that binds a key", () => {
    for (const command of COMMANDS) {
      expect(command.keys.length).toBeGreaterThan(0);
    }
    expect(new Set(COMMANDS.map((command) => command.id)).size).toBe(COMMANDS.length);
  });
});

describe("selection helpers", () => {
  it("selectedSummary follows the cursor", () => {
    const { store, deps } = setup({ ids: ["c", "b", "a"] });

    dispatchKey(deps, key("j"));

    expect(selectedSummary(store.getState())?.id).toBe("b");
  });
});
