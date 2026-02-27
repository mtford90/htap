/**
 * Hook for fetching and polling captured requests from the daemon.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  BodySearchOptions,
  CapturedRequest,
  CapturedRequestSummary,
  RequestFilter,
} from "../../../shared/types.js";
import { ControlClient } from "../../../shared/control-client.js";
import { findProjectRoot, getHttapPaths } from "../../../shared/project.js";

const DEFAULT_QUERY_LIMIT = 1000;
const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_DELTA_LIMIT = 500;
const MAX_DELTA_BATCHES_PER_SYNC = 8;
const MAX_SNAPSHOT_BATCHES = 200;

interface UseRequestsOptions {
  pollInterval?: number;
  filter?: RequestFilter;
  bodySearch?: BodySearchOptions;
  projectRoot?: string;
}

interface UseRequestsResult {
  /** Request summaries for list display (excludes body/header data) */
  requests: CapturedRequestSummary[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Fetch full request data including body/headers */
  getFullRequest: (id: string) => Promise<CapturedRequest | null>;
  /** Fetch all requests with full data (for exports) */
  getAllFullRequests: () => Promise<CapturedRequest[]>;
  /** Replay a captured request by ID. Returns the new replayed request ID on success. */
  replayRequest?: (id: string) => Promise<string | null>;
  /** Toggle the saved/bookmark state of a request */
  toggleSaved: (id: string, currentlySaved: boolean) => Promise<boolean>;
  /** Clear all unsaved requests */
  clearRequests: () => Promise<boolean>;
}

interface SnapshotState {
  requests: CapturedRequestSummary[];
  summaryById: Map<string, CapturedRequestSummary>;
  orderSeqById: Map<string, number>;
  cursor: number;
}

/**
 * Hook to fetch and poll for captured requests.
 */
export function useRequests(options: UseRequestsOptions = {}): UseRequestsResult {
  const { pollInterval = DEFAULT_POLL_INTERVAL_MS, filter, bodySearch, projectRoot } = options;

  const [requests, setRequests] = useState<CapturedRequestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<ControlClient | null>(null);
  const filterRef = useRef<RequestFilter | undefined>(filter);
  const bodySearchRef = useRef<BodySearchOptions | undefined>(bodySearch);

  const summaryByIdRef = useRef<Map<string, CapturedRequestSummary>>(new Map());
  const orderSeqByIdRef = useRef<Map<string, number>>(new Map());
  const cursorRef = useRef(0);

  const syncGenerationRef = useRef(0);
  const inFlightRef = useRef(false);
  const rerunRequestedRef = useRef(false);
  const snapshotRequestedRef = useRef(true);
  const activeSyncPromiseRef = useRef<Promise<void> | null>(null);

  const resetDeltaState = useCallback(() => {
    summaryByIdRef.current = new Map();
    orderSeqByIdRef.current = new Map();
    cursorRef.current = 0;
  }, []);

  const buildOrderedList = useCallback(
    (
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

      // Keep in-memory maps bounded to the list limit.
      for (const id of ids) {
        if (!limitedIdSet.has(id)) {
          summaryById.delete(id);
          orderSeqById.delete(id);
        }
      }

      return limitedIds
        .map((id) => summaryById.get(id))
        .filter((entry): entry is CapturedRequestSummary => entry !== undefined);
    },
    []
  );

  const loadSnapshotFromDelta = useCallback(
    async (
      client: ControlClient,
      currentFilter: RequestFilter | undefined,
      generation: number
    ): Promise<SnapshotState | null> => {
      let afterChangeSeq = 0;
      let hasMore = true;
      let batches = 0;

      const summaryById = new Map<string, CapturedRequestSummary>();
      const orderSeqById = new Map<string, number>();

      while (hasMore && batches < MAX_SNAPSHOT_BATCHES) {
        const delta = await client.listRequestsSummaryDelta({
          afterChangeSeq,
          limit: DEFAULT_DELTA_LIMIT,
          filter: currentFilter,
        });

        if (generation !== syncGenerationRef.current) {
          return null;
        }

        if (delta.entries.length === 0) {
          afterChangeSeq = delta.cursor;
          hasMore = false;
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

      return {
        requests: ordered,
        summaryById,
        orderSeqById,
        cursor: afterChangeSeq,
      };
    },
    [buildOrderedList]
  );

  const syncOnce = useCallback(
    async (generation: number) => {
      const client = clientRef.current;
      if (!client) {
        return;
      }

      const currentFilter = filterRef.current;
      const currentBodySearch = bodySearchRef.current;

      try {
        if (currentBodySearch) {
          const bodySearchResults = await client.searchBodies({
            query: currentBodySearch.query,
            target: currentBodySearch.target,
            limit: DEFAULT_QUERY_LIMIT,
            filter: currentFilter,
          });

          if (generation !== syncGenerationRef.current) {
            return;
          }

          setRequests(bodySearchResults);
          setError(null);
          return;
        }

        let summaryById = new Map(summaryByIdRef.current);
        let orderSeqById = new Map(orderSeqByIdRef.current);
        let cursor = cursorRef.current;

        const requiresSnapshot = snapshotRequestedRef.current || summaryById.size === 0;

        if (requiresSnapshot) {
          const snapshot = await loadSnapshotFromDelta(client, currentFilter, generation);
          if (!snapshot || generation !== syncGenerationRef.current) {
            return;
          }

          summaryById = snapshot.summaryById;
          orderSeqById = snapshot.orderSeqById;
          cursor = snapshot.cursor;
          snapshotRequestedRef.current = false;

          summaryByIdRef.current = summaryById;
          orderSeqByIdRef.current = orderSeqById;
          cursorRef.current = cursor;

          setRequests(snapshot.requests);
          setError(null);
          return;
        }

        let batches = 0;
        let appliedAnyChanges = false;

        while (batches < MAX_DELTA_BATCHES_PER_SYNC) {
          const delta = await client.listRequestsSummaryDelta({
            afterChangeSeq: cursor,
            limit: DEFAULT_DELTA_LIMIT,
            filter: currentFilter,
          });

          if (generation !== syncGenerationRef.current) {
            return;
          }

          if (delta.entries.length === 0) {
            cursor = delta.cursor;
            break;
          }

          for (const entry of delta.entries) {
            summaryById.set(entry.summary.id, entry.summary);
            orderSeqById.set(entry.summary.id, entry.orderSeq);
          }

          cursor = delta.cursor;
          appliedAnyChanges = true;
          batches += 1;

          if (!delta.hasMore) {
            break;
          }
        }

        summaryByIdRef.current = summaryById;
        orderSeqByIdRef.current = orderSeqById;
        cursorRef.current = cursor;

        if (appliedAnyChanges) {
          const updated = buildOrderedList(summaryById, orderSeqById);
          setRequests(updated);
        }

        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to connect to daemon";
        if (message.includes("ENOENT") || message.includes("ECONNREFUSED")) {
          setError("Daemon not running. Start with 'eval \"$(httap on)\"'.");
        } else {
          setError(message);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [buildOrderedList, loadSnapshotFromDelta]
  );

  const runSync = useCallback(
    (forceSnapshot = false): Promise<void> => {
      if (forceSnapshot) {
        snapshotRequestedRef.current = true;
      }

      rerunRequestedRef.current = true;

      if (inFlightRef.current && activeSyncPromiseRef.current) {
        return activeSyncPromiseRef.current;
      }

      const syncPromise = (async () => {
        inFlightRef.current = true;

        try {
          while (rerunRequestedRef.current) {
            rerunRequestedRef.current = false;
            const generation = syncGenerationRef.current;
            await syncOnce(generation);
          }
        } finally {
          inFlightRef.current = false;
          activeSyncPromiseRef.current = null;
        }
      })();

      activeSyncPromiseRef.current = syncPromise;
      return syncPromise;
    },
    [syncOnce]
  );

  // Initialise control client
  useEffect(() => {
    const resolvedRoot = projectRoot ?? findProjectRoot();
    if (!resolvedRoot) {
      setError("Not in a httap project. Run 'eval \"$(httap on)\"' first.");
      setIsLoading(false);
      return;
    }

    const paths = getHttapPaths(resolvedRoot);
    clientRef.current = new ControlClient(paths.controlSocketFile);

    return () => {
      clientRef.current?.close();
    };
  }, [projectRoot]);

  // Keep refs in sync and trigger an immediate sync when search/filter changes.
  useEffect(() => {
    filterRef.current = filter;
    bodySearchRef.current = bodySearch;

    syncGenerationRef.current += 1;
    resetDeltaState();
    snapshotRequestedRef.current = true;

    void runSync(true);
  }, [filter, bodySearch, resetDeltaState, runSync]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    setIsLoading(true);
    syncGenerationRef.current += 1;
    resetDeltaState();
    await runSync(true);
  }, [resetDeltaState, runSync]);

  // Fetch full request data by ID
  const getFullRequest = useCallback(async (id: string): Promise<CapturedRequest | null> => {
    const client = clientRef.current;
    if (!client) {
      return null;
    }
    try {
      return await client.getRequest(id);
    } catch {
      return null;
    }
  }, []);

  // Fetch all requests with full data (for exports like HAR)
  const getAllFullRequests = useCallback(async (): Promise<CapturedRequest[]> => {
    const client = clientRef.current;
    if (!client) {
      return [];
    }
    try {
      return await client.listRequests({ limit: DEFAULT_QUERY_LIMIT });
    } catch {
      return [];
    }
  }, []);

  // Replay request and force refresh
  const replayRequest = useCallback(
    async (id: string): Promise<string | null> => {
      const client = clientRef.current;
      if (!client) {
        throw new Error("Not connected to daemon");
      }

      const replayed = await client.replayRequest({ id, initiator: "tui" });
      syncGenerationRef.current += 1;
      resetDeltaState();
      await runSync(true);
      return replayed.requestId;
    },
    [resetDeltaState, runSync]
  );

  // Toggle saved/bookmark state and force refresh
  const toggleSaved = useCallback(
    async (id: string, currentlySaved: boolean): Promise<boolean> => {
      const client = clientRef.current;
      if (!client) return false;
      try {
        const result = currentlySaved
          ? await client.unsaveRequest(id)
          : await client.saveRequest(id);
        if (result.success) {
          syncGenerationRef.current += 1;
          await runSync(false);
        }
        return result.success;
      } catch {
        return false;
      }
    },
    [runSync]
  );

  // Clear all unsaved requests
  const clearRequests = useCallback(async (): Promise<boolean> => {
    const client = clientRef.current;
    if (!client) return false;
    try {
      await client.clearRequests();
      syncGenerationRef.current += 1;
      resetDeltaState();
      await runSync(true);
      return true;
    } catch {
      return false;
    }
  }, [resetDeltaState, runSync]);

  // Initial fetch
  useEffect(() => {
    void runSync(true);
  }, [runSync]);

  // Polling
  useEffect(() => {
    const interval = setInterval(() => {
      void runSync(false);
    }, pollInterval);

    return () => clearInterval(interval);
  }, [pollInterval, runSync]);

  return {
    requests,
    isLoading,
    error,
    refresh,
    getFullRequest,
    getAllFullRequests,
    replayRequest,
    toggleSaved,
    clearRequests,
  };
}
