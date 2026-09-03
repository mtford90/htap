/**
 * Keeps the store in step with the daemon.
 *
 * Runs entirely outside React: it owns the delta cursor, the single-flight
 * loop, the detail cache and the polling timers, and it only ever writes to the
 * store. Tests drive it by calling `syncRequests()` and `syncInterceptors()`
 * directly instead of waiting for a timer.
 */

import type {
  BodySearchOptions,
  CapturedRequest,
  CapturedRequestSummary,
  InterceptorEvent,
  RequestFilter,
} from "../../shared/types.js";
import type { TuiActions } from "../store/store.js";

const DEFAULT_QUERY_LIMIT = 1000;
const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_DELTA_LIMIT = 500;
const MAX_DELTA_BATCHES_PER_SYNC = 8;
const MAX_SNAPSHOT_BATCHES = 200;
const DETAIL_CACHE_LIMIT = 50;
/** Interceptor events kept in memory; older ones drop off the front. */
export const MAX_INTERCEPTOR_EVENTS = 1000;

const DAEMON_DOWN_MESSAGE = "Daemon not running. Start with 'eval \"$(httap on)\"'.";

/** The slice of `ControlClient` the engine uses, so tests can supply a fake. */
export interface SyncClient {
  listRequestsSummaryDelta(options: {
    afterChangeSeq: number;
    limit?: number;
    filter?: RequestFilter;
  }): Promise<{
    entries: { summary: CapturedRequestSummary; orderSeq: number; changeSeq: number }[];
    cursor: number;
    hasMore: boolean;
  }>;
  searchBodies(options: {
    query: string;
    target?: BodySearchOptions["target"];
    limit?: number;
    filter?: RequestFilter;
  }): Promise<CapturedRequestSummary[]>;
  getRequest(id: string): Promise<CapturedRequest | null>;
  replayRequest(options: { id: string; initiator?: "tui" }): Promise<{ requestId: string }>;
  saveRequest(id: string): Promise<{ success: boolean }>;
  unsaveRequest(id: string): Promise<{ success: boolean }>;
  clearRequests(): Promise<void>;
  getInterceptorEvents(options?: { afterSeq?: number }): Promise<{
    events: InterceptorEvent[];
    counts: { info: number; warn: number; error: number };
  }>;
  status(): Promise<{ proxyPort?: number; interceptorCount?: number }>;
  close(): void;
}

export interface SyncEngineOptions {
  client: SyncClient;
  actions: TuiActions;
  pollInterval?: number;
}

/**
 * Sorts by the daemon's order sequence, newest first, and drops everything past
 * the display limit so the in-memory maps stay bounded.
 */
const buildOrderedList = (
  summaryById: Map<string, CapturedRequestSummary>,
  orderSeqById: Map<string, number>
): CapturedRequestSummary[] => {
  const ids = Array.from(summaryById.keys());
  ids.sort((a, b) => {
    const seqDiff = (orderSeqById.get(b) ?? 0) - (orderSeqById.get(a) ?? 0);
    if (seqDiff !== 0) {
      return seqDiff;
    }
    const aTs = summaryById.get(a)?.timestamp ?? 0;
    const bTs = summaryById.get(b)?.timestamp ?? 0;
    if (aTs !== bTs) {
      return bTs - aTs;
    }
    return b.localeCompare(a);
  });

  const limitedIds = ids.slice(0, DEFAULT_QUERY_LIMIT);
  const limitedIdSet = new Set(limitedIds);
  for (const id of ids) {
    if (!limitedIdSet.has(id)) {
      summaryById.delete(id);
      orderSeqById.delete(id);
    }
  }

  return limitedIds
    .map((id) => summaryById.get(id))
    .filter((entry): entry is CapturedRequestSummary => entry !== undefined);
};

const describeError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : "Failed to connect to daemon";
  return message.includes("ENOENT") || message.includes("ECONNREFUSED")
    ? DAEMON_DOWN_MESSAGE
    : message;
};

export class SyncEngine {
  private readonly client: SyncClient;
  private readonly actions: TuiActions;
  private readonly pollInterval: number;

  private filter: RequestFilter = {};
  private bodySearch: BodySearchOptions | undefined;

  private summaryById = new Map<string, CapturedRequestSummary>();
  private orderSeqById = new Map<string, number>();
  private cursor = 0;
  private snapshotRequested = true;

  private generation = 0;
  private inFlight: Promise<void> | null = null;
  private rerunRequested = false;

  private lastEventSeq = 0;
  private events: InterceptorEvent[] = [];

  private readonly detailCache = new Map<string, CapturedRequest>();
  private readonly detailInFlight = new Map<string, Promise<CapturedRequest | null>>();
  private detailRequestId: string | null = null;

  private timer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor({ client, actions, pollInterval }: SyncEngineOptions) {
    this.client = client;
    this.actions = actions;
    this.pollInterval = pollInterval ?? DEFAULT_POLL_INTERVAL_MS;
  }

  /** Fetches once immediately, then polls until `stop()`. */
  start(): void {
    void this.syncAll();
    this.timer = setInterval(() => void this.syncAll(), this.pollInterval);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.client.close();
  }

  async syncAll(): Promise<void> {
    await Promise.all([this.syncRequests(), this.syncInterceptors()]);
  }

  setFilter(filter: RequestFilter, bodySearch: BodySearchOptions | undefined): void {
    this.filter = filter;
    this.bodySearch = bodySearch;
    this.actions.setFilter(filter, bodySearch);
    this.invalidate();
    void this.syncRequests();
  }

  /** Discards the delta cursor so the next sync rebuilds the list from scratch. */
  private invalidate(): void {
    this.generation += 1;
    this.summaryById = new Map();
    this.orderSeqById = new Map();
    this.cursor = 0;
    this.snapshotRequested = true;
  }

  async refresh(): Promise<void> {
    this.actions.setLoading(true);
    this.invalidate();
    await this.syncRequests();
  }

  /** Coalesces concurrent callers onto one in-flight pass, then reruns if asked again. */
  syncRequests(): Promise<void> {
    this.rerunRequested = true;
    if (this.inFlight) {
      return this.inFlight;
    }

    const run = (async () => {
      try {
        while (this.rerunRequested && !this.stopped) {
          this.rerunRequested = false;
          await this.syncRequestsOnce(this.generation);
        }
      } finally {
        this.inFlight = null;
      }
    })();

    this.inFlight = run;
    return run;
  }

  private async syncRequestsOnce(generation: number): Promise<void> {
    try {
      if (this.bodySearch) {
        const results = await this.client.searchBodies({
          query: this.bodySearch.query,
          target: this.bodySearch.target,
          limit: DEFAULT_QUERY_LIMIT,
          filter: this.filter,
        });
        if (generation === this.generation) {
          this.actions.setRequests(results);
        }
        return;
      }

      if (this.snapshotRequested || this.summaryById.size === 0) {
        await this.loadSnapshot(generation);
        return;
      }

      await this.applyDeltas(generation);
    } catch (error) {
      this.actions.setError(describeError(error));
    }
  }

  private async loadSnapshot(generation: number): Promise<void> {
    const summaryById = new Map<string, CapturedRequestSummary>();
    const orderSeqById = new Map<string, number>();
    let afterChangeSeq = 0;
    let hasMore = true;
    let batches = 0;

    while (hasMore && batches < MAX_SNAPSHOT_BATCHES) {
      const delta = await this.client.listRequestsSummaryDelta({
        afterChangeSeq,
        limit: DEFAULT_DELTA_LIMIT,
        filter: this.filter,
      });
      if (generation !== this.generation) {
        return;
      }
      if (delta.entries.length === 0) {
        afterChangeSeq = delta.cursor;
        break;
      }
      for (const entry of delta.entries) {
        summaryById.set(entry.summary.id, entry.summary);
        orderSeqById.set(entry.summary.id, entry.orderSeq);
      }
      afterChangeSeq = delta.cursor;
      hasMore = delta.hasMore;
      batches += 1;
    }

    const ordered = buildOrderedList(summaryById, orderSeqById);
    this.summaryById = summaryById;
    this.orderSeqById = orderSeqById;
    this.cursor = afterChangeSeq;
    this.snapshotRequested = false;
    this.actions.setRequests(ordered);
  }

  private async applyDeltas(generation: number): Promise<void> {
    const summaryById = new Map(this.summaryById);
    const orderSeqById = new Map(this.orderSeqById);
    const changedIds = new Set<string>();
    let cursor = this.cursor;
    let batches = 0;
    let changed = false;

    while (batches < MAX_DELTA_BATCHES_PER_SYNC) {
      const delta = await this.client.listRequestsSummaryDelta({
        afterChangeSeq: cursor,
        limit: DEFAULT_DELTA_LIMIT,
        filter: this.filter,
      });
      if (generation !== this.generation) {
        return;
      }
      if (delta.entries.length === 0) {
        cursor = delta.cursor;
        break;
      }
      for (const entry of delta.entries) {
        summaryById.set(entry.summary.id, entry.summary);
        orderSeqById.set(entry.summary.id, entry.orderSeq);
        changedIds.add(entry.summary.id);
      }
      cursor = delta.cursor;
      changed = true;
      batches += 1;
      if (!delta.hasMore) {
        break;
      }
    }

    this.summaryById = summaryById;
    this.orderSeqById = orderSeqById;
    this.cursor = cursor;

    if (changed) {
      this.actions.setRequests(buildOrderedList(summaryById, orderSeqById));
      this.invalidateChangedDetails(changedIds);
    } else {
      this.actions.setError(null);
    }
  }

  async syncInterceptors(): Promise<void> {
    try {
      const [result, status] = await Promise.all([
        this.client.getInterceptorEvents({ afterSeq: this.lastEventSeq }),
        this.client.status(),
      ]);

      const last = result.events[result.events.length - 1];
      if (last) {
        this.lastEventSeq = last.seq;
        this.events = [...this.events, ...result.events].slice(-MAX_INTERCEPTOR_EVENTS);
      }

      this.actions.setInterceptorEvents(this.events, result.counts, status.interceptorCount ?? 0);
    } catch {
      // The daemon may be down or predate interceptor events; the request sync
      // already surfaces connection failures, so stay quiet here.
    }
  }

  /**
   * Loads the full request behind the current selection, serving repeats from a
   * bounded cache and ignoring responses that a later selection has superseded.
   */
  selectDetail(id: string | null): void {
    this.detailRequestId = id;

    if (id === null) {
      this.actions.setDetail(null, null);
      return;
    }

    const cached = this.detailCache.get(id);
    if (cached) {
      this.actions.setDetail(id, cached);
      return;
    }

    void this.fetchDetail(id).then((request) => {
      if (this.detailRequestId === id) {
        this.actions.setDetail(id, request);
      }
    });
  }

  private fetchDetail(id: string): Promise<CapturedRequest | null> {
    const existing = this.detailInFlight.get(id);
    if (existing) {
      return existing;
    }

    const pending = this.client
      .getRequest(id)
      .catch(() => null)
      .then((request) => {
        // A request that has no response yet will change, so caching it would
        // pin an empty Response section for the life of the process.
        if (request?.responseStatus !== undefined) {
          this.cacheDetail(id, request);
        }
        this.detailInFlight.delete(id);
        return request;
      });

    this.detailInFlight.set(id, pending);
    return pending;
  }

  private cacheDetail(id: string, request: CapturedRequest): void {
    this.detailCache.delete(id);
    this.detailCache.set(id, request);
    if (this.detailCache.size > DETAIL_CACHE_LIMIT) {
      const oldest = this.detailCache.keys().next();
      if (!oldest.done) {
        this.detailCache.delete(oldest.value);
      }
    }
  }

  /** Drops cached detail for one request so the next selection refetches it. */
  invalidateDetail(id: string): void {
    this.detailCache.delete(id);
  }

  /**
   * A delta means the daemon has newer data for those rows, so their cached
   * detail is stale; the one on screen is refetched straight away.
   */
  private invalidateChangedDetails(changedIds: ReadonlySet<string>): void {
    for (const id of changedIds) {
      this.detailCache.delete(id);
    }
    if (this.detailRequestId !== null && changedIds.has(this.detailRequestId)) {
      this.selectDetail(this.detailRequestId);
    }
  }

  async replay(id: string): Promise<string | null> {
    const { requestId } = await this.client.replayRequest({ id, initiator: "tui" });
    this.invalidate();
    await this.syncRequests();
    return requestId;
  }

  async toggleSaved(id: string, currentlySaved: boolean): Promise<boolean> {
    try {
      const result = currentlySaved
        ? await this.client.unsaveRequest(id)
        : await this.client.saveRequest(id);
      if (result.success) {
        this.invalidateDetail(id);
        this.generation += 1;
        await this.syncRequests();
      }
      return result.success;
    } catch {
      return false;
    }
  }

  async clear(): Promise<boolean> {
    try {
      await this.client.clearRequests();
      this.detailCache.clear();
      this.invalidate();
      await this.syncRequests();
      return true;
    } catch {
      return false;
    }
  }
}
