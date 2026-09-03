import { describe, expect, it, vi } from "vitest";
import type { CapturedRequest, CapturedRequestSummary } from "../../shared/types.js";
import { createTuiActions, createTuiStore } from "../store/store.js";
import { MAX_INTERCEPTOR_EVENTS, SyncEngine, type SyncClient } from "./engine.js";

const summary = (id: string, orderSeq: number): CapturedRequestSummary => ({
  id,
  sessionId: "session",
  timestamp: orderSeq,
  method: "GET",
  url: `https://example.test/${id}`,
  host: "example.test",
  path: `/${id}`,
  requestBodySize: 0,
  responseBodySize: 0,
});

const fullRequest = (id: string): CapturedRequest => ({
  id,
  sessionId: "session",
  timestamp: 1,
  method: "GET",
  url: `https://example.test/${id}`,
  host: "example.test",
  path: `/${id}`,
  requestHeaders: {},
});

interface DeltaBatch {
  entries: { summary: CapturedRequestSummary; orderSeq: number; changeSeq: number }[];
  cursor: number;
  hasMore: boolean;
}

const batch = (
  rows: [id: string, orderSeq: number][],
  cursor: number,
  hasMore = false
): DeltaBatch => ({
  entries: rows.map(([id, orderSeq]) => ({
    summary: summary(id, orderSeq),
    orderSeq,
    changeSeq: orderSeq,
  })),
  cursor,
  hasMore,
});

const createFakeClient = (overrides: Partial<SyncClient> = {}) => {
  const client: SyncClient = {
    listRequestsSummaryDelta: vi.fn(async () => batch([], 0)),
    searchBodies: vi.fn(async () => []),
    getRequest: vi.fn(async (id: string) => fullRequest(id)),
    replayRequest: vi.fn(async () => ({ requestId: "replayed" })),
    saveRequest: vi.fn(async () => ({ success: true })),
    unsaveRequest: vi.fn(async () => ({ success: true })),
    clearRequests: vi.fn(async () => undefined),
    getInterceptorEvents: vi.fn(async () => ({
      events: [],
      counts: { info: 0, warn: 0, error: 0 },
    })),
    status: vi.fn(async () => ({ interceptorCount: 0 })),
    close: vi.fn(),
    ...overrides,
  };
  return client;
};

const setup = (overrides: Partial<SyncClient> = {}) => {
  const store = createTuiStore({ startTime: 0 });
  const actions = createTuiActions(store);
  const client = createFakeClient(overrides);
  const engine = new SyncEngine({ client, actions });
  return { store, actions, client, engine };
};

const listIds = (store: ReturnType<typeof createTuiStore>): string[] =>
  store.getState().requests.items.map((item) => item.id);

describe("request sync", () => {
  it("loads a snapshot ordered newest first", async () => {
    const { store, engine } = setup({
      listRequestsSummaryDelta: vi.fn(async () =>
        batch(
          [
            ["a", 1],
            ["b", 2],
          ],
          2
        )
      ),
    });

    await engine.syncRequests();

    expect(listIds(store)).toEqual(["b", "a"]);
    expect(store.getState().requests.loading).toBe(false);
  });

  it("pages through a snapshot that arrives in batches", async () => {
    const pages = [batch([["a", 1]], 1, true), batch([["b", 2]], 2, false)];
    const listRequestsSummaryDelta = vi.fn(async () => pages.shift() ?? batch([], 2));
    const { store, engine } = setup({ listRequestsSummaryDelta });

    await engine.syncRequests();

    expect(listIds(store)).toEqual(["b", "a"]);
    expect(listRequestsSummaryDelta).toHaveBeenCalledTimes(2);
  });

  it("applies later deltas from the cursor instead of re-reading everything", async () => {
    const listRequestsSummaryDelta = vi
      .fn<SyncClient["listRequestsSummaryDelta"]>()
      .mockResolvedValueOnce(batch([["a", 1]], 1))
      .mockResolvedValueOnce(batch([["b", 2]], 2))
      .mockResolvedValue(batch([], 2));
    const { store, engine } = setup({ listRequestsSummaryDelta });

    await engine.syncRequests();
    await engine.syncRequests();

    expect(listIds(store)).toEqual(["b", "a"]);
    expect(listRequestsSummaryDelta.mock.calls[1]?.[0]?.afterChangeSeq).toBe(1);
  });

  it("coalesces concurrent syncs onto one pass", async () => {
    const listRequestsSummaryDelta = vi.fn(async () => batch([["a", 1]], 1));
    const { engine } = setup({ listRequestsSummaryDelta });

    await Promise.all([engine.syncRequests(), engine.syncRequests(), engine.syncRequests()]);

    // One snapshot pass plus one rerun for the coalesced callers.
    expect(listRequestsSummaryDelta.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("reports a missing daemon in plain language", async () => {
    const { store, engine } = setup({
      listRequestsSummaryDelta: vi.fn(() => Promise.reject(new Error("connect ENOENT /tmp/sock"))),
    });

    await engine.syncRequests();

    expect(store.getState().requests.error).toContain("Daemon not running");
  });

  it("passes other errors through unchanged", async () => {
    const { store, engine } = setup({
      listRequestsSummaryDelta: vi.fn(() => Promise.reject(new Error("control timeout"))),
    });

    await engine.syncRequests();

    expect(store.getState().requests.error).toBe("control timeout");
  });

  it("uses the body search endpoint when a body search is set", async () => {
    const searchBodies = vi.fn(async () => [summary("hit", 1)]);
    const { store, engine, client } = setup({ searchBodies });

    engine.setFilter({}, { query: "error", target: "request" });
    await engine.syncRequests();

    expect(searchBodies).toHaveBeenCalledWith(
      expect.objectContaining({ query: "error", target: "request" })
    );
    expect(client.listRequestsSummaryDelta).not.toHaveBeenCalled();
    expect(listIds(store)).toEqual(["hit"]);
  });

  it("re-reads from scratch after the filter changes", async () => {
    const listRequestsSummaryDelta = vi
      .fn<SyncClient["listRequestsSummaryDelta"]>()
      .mockResolvedValueOnce(batch([["a", 1]], 1))
      .mockResolvedValue(batch([["b", 2]], 2));
    const { engine } = setup({ listRequestsSummaryDelta });
    await engine.syncRequests();
    const callsBefore = listRequestsSummaryDelta.mock.calls.length;

    engine.setFilter({ methods: ["POST"] }, undefined);
    await engine.syncRequests();

    const firstAfterChange = listRequestsSummaryDelta.mock.calls[callsBefore]?.[0];
    expect(firstAfterChange?.afterChangeSeq).toBe(0);
    expect(firstAfterChange?.filter).toEqual({ methods: ["POST"] });
  });
});

describe("detail loading", () => {
  it("stores the full request for the selected row", async () => {
    const { store, engine } = setup();

    engine.selectDetail("a");
    await vi.waitFor(() => expect(store.getState().detail.requestId).toBe("a"));

    expect(store.getState().detail.request?.id).toBe("a");
  });

  it("serves a repeat selection from the cache", async () => {
    const getRequest = vi.fn(async (id: string) => fullRequest(id));
    const { store, engine } = setup({ getRequest });

    engine.selectDetail("a");
    await vi.waitFor(() => expect(store.getState().detail.request).not.toBeNull());
    engine.selectDetail("b");
    await vi.waitFor(() => expect(store.getState().detail.requestId).toBe("b"));
    engine.selectDetail("a");

    expect(store.getState().detail.request?.id).toBe("a");
    expect(getRequest).toHaveBeenCalledTimes(2);
  });

  it("ignores a response that a newer selection has superseded", async () => {
    const resolvers = new Map<string, (request: CapturedRequest) => void>();
    const getRequest = vi.fn(
      (id: string) =>
        new Promise<CapturedRequest | null>((resolve) => {
          resolvers.set(id, resolve);
        })
    );
    const { store, engine } = setup({ getRequest });

    engine.selectDetail("slow");
    engine.selectDetail("fast");
    resolvers.get("fast")?.(fullRequest("fast"));
    await vi.waitFor(() => expect(store.getState().detail.requestId).toBe("fast"));
    resolvers.get("slow")?.(fullRequest("slow"));
    await Promise.resolve();

    expect(store.getState().detail.requestId).toBe("fast");
  });

  it("clears the detail pane when nothing is selected", () => {
    const { store, engine } = setup();

    engine.selectDetail(null);

    expect(store.getState().detail).toEqual({ requestId: null, request: null });
  });

  it("keeps a failed fetch from crashing the pane", async () => {
    const { store, engine } = setup({
      getRequest: vi.fn(() => Promise.reject(new Error("socket closed"))),
    });

    engine.selectDetail("a");
    await vi.waitFor(() => expect(store.getState().detail.requestId).toBe("a"));

    expect(store.getState().detail.request).toBeNull();
  });
});

describe("interceptor sync", () => {
  it("accumulates events across polls and tracks the cursor", async () => {
    const getInterceptorEvents = vi
      .fn<SyncClient["getInterceptorEvents"]>()
      .mockResolvedValueOnce({
        events: [{ seq: 1, level: "info" } as never],
        counts: { info: 1, warn: 0, error: 0 },
      })
      .mockResolvedValueOnce({
        events: [{ seq: 2, level: "error" } as never],
        counts: { info: 1, warn: 0, error: 1 },
      });
    const { store, engine } = setup({
      getInterceptorEvents,
      status: vi.fn(async () => ({ interceptorCount: 3 })),
    });

    await engine.syncInterceptors();
    await engine.syncInterceptors();

    expect(store.getState().interceptors.events).toHaveLength(2);
    expect(store.getState().interceptors.counts.error).toBe(1);
    expect(store.getState().interceptors.count).toBe(3);
    expect(getInterceptorEvents.mock.calls[1]?.[0]?.afterSeq).toBe(1);
  });

  it("leaves the interceptor slice alone when an idle poll changes nothing", async () => {
    const counts = { info: 1, warn: 0, error: 0 };
    const getInterceptorEvents = vi
      .fn<SyncClient["getInterceptorEvents"]>()
      .mockResolvedValueOnce({ events: [{ seq: 1, level: "info" } as never], counts })
      .mockResolvedValue({ events: [], counts });
    const { store, engine } = setup({ getInterceptorEvents });
    await engine.syncInterceptors();
    const slice = store.getState().interceptors;

    await engine.syncInterceptors();

    expect(store.getState().interceptors).toBe(slice);
  });

  it("drops the oldest events once the cap is reached", async () => {
    const events = Array.from(
      { length: MAX_INTERCEPTOR_EVENTS + 50 },
      (_, index) => ({ seq: index + 1, level: "info" }) as never
    );
    const { store, engine } = setup({
      getInterceptorEvents: vi.fn(async () => ({
        events,
        counts: { info: events.length, warn: 0, error: 0 },
      })),
    });

    await engine.syncInterceptors();

    const kept = store.getState().interceptors.events;
    expect(kept).toHaveLength(MAX_INTERCEPTOR_EVENTS);
    expect(kept[0]?.seq).toBe(51);
  });

  it("stays quiet when the daemon does not answer", async () => {
    const { store, engine } = setup({
      getInterceptorEvents: vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))),
    });

    await engine.syncInterceptors();

    expect(store.getState().interceptors.events).toEqual([]);
    expect(store.getState().requests.error).toBeNull();
  });
});

describe("mutations", () => {
  it("replays a request and reloads the list", async () => {
    const { engine, client } = setup();

    const requestId = await engine.replay("a");

    expect(requestId).toBe("replayed");
    expect(client.replayRequest).toHaveBeenCalledWith({ id: "a", initiator: "tui" });
    expect(client.listRequestsSummaryDelta).toHaveBeenCalled();
  });

  it("bookmarks and un-bookmarks through the matching endpoint", async () => {
    const { engine, client } = setup();

    await engine.toggleSaved("a", false);
    expect(client.saveRequest).toHaveBeenCalledWith("a");

    await engine.toggleSaved("a", true);
    expect(client.unsaveRequest).toHaveBeenCalledWith("a");
  });

  it("reports a failed bookmark instead of throwing", async () => {
    const { engine } = setup({ saveRequest: vi.fn(() => Promise.reject(new Error("nope"))) });

    await expect(engine.toggleSaved("a", false)).resolves.toBe(false);
  });

  it("drops cached detail after a bookmark change", async () => {
    const getRequest = vi.fn(async (id: string) => fullRequest(id));
    const { store, engine } = setup({ getRequest });
    engine.selectDetail("a");
    await vi.waitFor(() => expect(store.getState().detail.request).not.toBeNull());

    await engine.toggleSaved("a", false);
    engine.selectDetail("a");
    await vi.waitFor(() => expect(getRequest).toHaveBeenCalledTimes(2));

    expect(getRequest).toHaveBeenCalledTimes(2);
  });

  it("clears requests and reloads", async () => {
    const { engine, client } = setup();

    await expect(engine.clear()).resolves.toBe(true);
    expect(client.clearRequests).toHaveBeenCalled();
  });

  it("reports a failed clear instead of throwing", async () => {
    const { engine } = setup({ clearRequests: vi.fn(() => Promise.reject(new Error("nope"))) });

    await expect(engine.clear()).resolves.toBe(false);
  });
});

describe("lifecycle", () => {
  it("stops polling and closes the client", () => {
    vi.useFakeTimers();
    const { engine, client } = setup();
    engine.start();

    engine.stop();
    vi.advanceTimersByTime(10_000);

    expect(client.close).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
