import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { CapturedRequestSummary } from "../../../shared/types.js";
import {
  countPrependedRequests,
  resolveEffectiveListScrollOffset,
  resolveSelectedIndex,
} from "../state/request-list-state.js";

interface UseRequestListStateOptions {
  requests: CapturedRequestSummary[];
  visibleListHeight: number;
}

interface UseRequestListStateResult {
  selectedRequestId: string | null;
  setSelectedRequestId: Dispatch<SetStateAction<string | null>>;
  topVisibleRequestId: string | null;
  setTopVisibleRequestId: Dispatch<SetStateAction<string | null>>;
  pendingNewCount: number;
  setPendingNewCount: Dispatch<SetStateAction<number>>;
  following: boolean;
  setFollowing: Dispatch<SetStateAction<boolean>>;
  selectedIndex: number;
  effectiveListScrollOffset: number;
  selectedSummary: CapturedRequestSummary | undefined;
  resetToFollowMode: () => void;
}

export function useRequestListState({
  requests,
  visibleListHeight,
}: UseRequestListStateOptions): UseRequestListStateResult {
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [topVisibleRequestId, setTopVisibleRequestId] = useState<string | null>(null);
  const [pendingNewCount, setPendingNewCount] = useState(0);
  const [following, setFollowing] = useState(true);

  const maxListOffset = Math.max(0, requests.length - visibleListHeight);

  const selectedIndex = useMemo(
    () => resolveSelectedIndex({ requests, selectedRequestId, following }),
    [requests, selectedRequestId, following]
  );

  const effectiveListScrollOffset = useMemo(
    () =>
      resolveEffectiveListScrollOffset({
        requests,
        following,
        topVisibleRequestId,
        selectedIndex,
        maxListOffset,
      }),
    [requests, following, topVisibleRequestId, selectedIndex, maxListOffset]
  );

  const selectedSummary = selectedIndex >= 0 ? requests[selectedIndex] : undefined;

  const resetToFollowMode = useCallback(() => {
    setFollowing(true);
    setSelectedRequestId(null);
    setTopVisibleRequestId(null);
    setPendingNewCount(0);
  }, []);

  // Keep browse-mode selection valid when the selected request disappears.
  useEffect(() => {
    if (following) {
      return;
    }

    if (requests.length === 0) {
      if (selectedRequestId !== null) {
        setSelectedRequestId(null);
      }
      return;
    }

    if (!selectedRequestId) {
      return;
    }

    if (!requests.some((request) => request.id === selectedRequestId)) {
      const fallbackIndex = Math.min(effectiveListScrollOffset, requests.length - 1);
      setSelectedRequestId(requests[fallbackIndex]?.id ?? requests[0]?.id ?? null);
    }
  }, [following, requests, selectedRequestId, effectiveListScrollOffset]);

  // Track how many new requests arrived while browsing.
  const previousRequestIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const previousIds = previousRequestIdsRef.current;

    if (following) {
      setPendingNewCount(0);
      previousRequestIdsRef.current = requests.map((request) => request.id);
      return;
    }

    const prependedCount = countPrependedRequests(previousIds, requests);
    if (prependedCount > 0) {
      setPendingNewCount((previous) => previous + prependedCount);
    }

    previousRequestIdsRef.current = requests.map((request) => request.id);
  }, [requests, following]);

  // Keep selected row visible in browse mode.
  useEffect(() => {
    if (following || selectedIndex < 0) {
      return;
    }

    const currentOffset = effectiveListScrollOffset;

    if (selectedIndex < currentOffset) {
      setTopVisibleRequestId(requests[selectedIndex]?.id ?? null);
      return;
    }

    if (selectedIndex >= currentOffset + visibleListHeight) {
      const nextOffset = selectedIndex - visibleListHeight + 1;
      setTopVisibleRequestId(requests[nextOffset]?.id ?? null);
    }
  }, [following, selectedIndex, effectiveListScrollOffset, visibleListHeight, requests]);

  return {
    selectedRequestId,
    setSelectedRequestId,
    topVisibleRequestId,
    setTopVisibleRequestId,
    pendingNewCount,
    setPendingNewCount,
    following,
    setFollowing,
    selectedIndex,
    effectiveListScrollOffset,
    selectedSummary,
    resetToFollowMode,
  };
}
