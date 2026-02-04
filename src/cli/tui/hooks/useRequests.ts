/**
 * Hook for fetching and polling captured requests from the daemon.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { CapturedRequest } from "../../../shared/types.js";
import { ControlClient } from "../../../daemon/control.js";
import { findProjectRoot, getHtpxPaths } from "../../../shared/project.js";

interface UseRequestsOptions {
  pollInterval?: number;
}

interface UseRequestsResult {
  requests: CapturedRequest[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and poll for captured requests.
 */
export function useRequests(options: UseRequestsOptions = {}): UseRequestsResult {
  const { pollInterval = 2000 } = options;

  const [requests, setRequests] = useState<CapturedRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<ControlClient | null>(null);
  const lastCountRef = useRef<number>(0);

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

  // Fetch requests from daemon
  const fetchRequests = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      return;
    }

    try {
      // First check the count to avoid unnecessary data transfer
      const count = await client.countRequests({});

      // Only fetch full list if count changed
      if (count !== lastCountRef.current || requests.length === 0) {
        const newRequests = await client.listRequests({
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
  }, [requests.length]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    setIsLoading(true);
    lastCountRef.current = 0; // Force full refresh
    await fetchRequests();
  }, [fetchRequests]);

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
  };
}
