/**
 * Hook for fetching and polling captured requests from the daemon.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { CapturedRequest, CapturedRequestSummary } from "../../../shared/types.js";
import { ControlClient } from "../../../shared/control-client.js";
import { findProjectRoot, getHtpxPaths } from "../../../shared/project.js";

interface UseRequestsOptions {
  pollInterval?: number;
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
}

/**
 * Hook to fetch and poll for captured requests.
 */
export function useRequests(options: UseRequestsOptions = {}): UseRequestsResult {
  const { pollInterval = 2000 } = options;

  const [requests, setRequests] = useState<CapturedRequestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<ControlClient | null>(null);
  const lastCountRef = useRef<number>(0);
  const requestsLengthRef = useRef<number>(0);

  // Initialise control client
  useEffect(() => {
    const projectRoot = findProjectRoot();
    if (!projectRoot) {
      setError("Not in an htpx project. Run 'htpx init' first.");
      setIsLoading(false);
      return;
    }
    const paths = getHtpxPaths(projectRoot);
    clientRef.current = new ControlClient(paths.controlSocketFile);
  }, []);

  // Keep ref in sync with requests length
  useEffect(() => {
    requestsLengthRef.current = requests.length;
  }, [requests.length]);

  // Fetch request summaries from daemon
  const fetchRequests = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      return;
    }

    try {
      // First check the count to avoid unnecessary data transfer
      const count = await client.countRequests({});

      // Only fetch list if count changed or we have no requests yet
      if (count !== lastCountRef.current || requestsLengthRef.current === 0) {
        const newRequests = await client.listRequestsSummary({
          limit: 1000,
        });
        setRequests(newRequests);
        lastCountRef.current = count;
      }

      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect to daemon";
      if (message.includes("ENOENT") || message.includes("ECONNREFUSED")) {
        setError("Daemon not running. Start with 'htpx intercept'.");
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Manual refresh function
  const refresh = useCallback(async () => {
    setIsLoading(true);
    lastCountRef.current = 0; // Force full refresh
    await fetchRequests();
  }, [fetchRequests]);

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
      return await client.listRequests({ limit: 1000 });
    } catch {
      return [];
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  // Polling
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchRequests();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [fetchRequests, pollInterval]);

  return {
    requests,
    isLoading,
    error,
    refresh,
    getFullRequest,
    getAllFullRequests,
  };
}
