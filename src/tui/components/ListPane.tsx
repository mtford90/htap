/** @jsxImportSource @opentui/react */

/**
 * Left panel: the captured requests, newest first.
 *
 * The scrollbox owns the viewport position and culls the rows outside it, so a
 * long list costs no more to draw than a short one.
 */

import React, { useCallback, useEffect, useRef } from "react";
import type { CapturedRequestSummary } from "../../shared/types.js";
import type { TuiActions } from "../store/store.js";
import { countPrependedRequests } from "../store/list-geometry.js";
import { useScroller } from "../hooks/useScroller.js";
import { DIM } from "./styles.js";
import { Panel } from "./Panel.js";
import { RequestRow, requestRowId } from "./RequestRow.js";

export interface ListPaneProps {
  requests: CapturedRequestSummary[];
  selectedIndex: number;
  /** The row the cursor is pinned to, or null while the viewport is free. */
  cursorId: string | null;
  actions: TuiActions;
  isActive: boolean;
  isHovered: boolean;
  width: number;
  height: number;
  showFullUrl: boolean;
  searchTerm?: string;
  following: boolean;
  pendingNewCount: number;
  onSelectIndex: (index: number) => void;
  onActivate: () => void;
  onHoverChange: (hovered: boolean) => void;
}

const EmptyState = (): React.ReactNode => (
  <box flexDirection="column" paddingLeft={1} paddingRight={1} paddingTop={1}>
    <text attributes={DIM}>No requests captured yet.</text>
    <text> </text>
    <text>
      <span>Run </span>
      <span fg="cyan">eval &quot;$(httap on)&quot;</span>
      <span> in another terminal</span>
    </text>
    <text attributes={DIM}>to start capturing traffic.</text>
  </box>
);

export function ListPane({
  requests,
  selectedIndex,
  cursorId,
  actions,
  isActive,
  isHovered,
  width,
  height,
  showFullUrl,
  searchTerm,
  following,
  pendingNewCount,
  onSelectIndex,
  onActivate,
  onHoverChange,
}: ListPaneProps): React.ReactNode {
  const { ref, scrollTop, syncScrollTop } = useScroller("list", actions);
  const previousIds = useRef<string[]>([]);
  const visibleHeight = Math.max(1, height - 2);

  // Follow mode pins the newest row; while browsing, rows arriving above the
  // viewport must not push the rows under the cursor down the screen.
  useEffect(() => {
    const box = ref.current;
    const previous = previousIds.current;
    previousIds.current = requests.map((request) => request.id);
    if (!box) {
      return;
    }
    if (following) {
      box.scrollTo(0);
      syncScrollTop();
      return;
    }
    const prepended = countPrependedRequests(previous, requests);
    if (prepended === 0) {
      return;
    }
    // The scrollbox clamps against the content height it last measured, so
    // the compensation has to wait until layout has seen the new rows.
    const compensate = (): void => {
      box.scrollBy(prepended);
      syncScrollTop();
    };
    box.content.once("resize", compensate);
    return () => {
      box.content.off("resize", compensate);
    };
  }, [requests, following, ref, syncScrollTop]);

  // Only a cursor the user moved drags the viewport; wheel scrolling leaves it
  // unpinned so the list does not snap back to the selection.
  useEffect(() => {
    if (cursorId === null) {
      return;
    }
    ref.current?.scrollChildIntoView(requestRowId(cursorId));
    syncScrollTop();
  }, [cursorId, visibleHeight, ref, syncScrollTop]);

  // The scrollbox has already moved by the time the wheel event bubbles here.
  const handleWheel = useCallback(() => {
    actions.stopFollowing();
    syncScrollTop();
  }, [actions, syncScrollTop]);

  const rightValue =
    requests.length > visibleHeight
      ? `${scrollTop + 1}-${Math.min(scrollTop + visibleHeight, requests.length)}/${requests.length}`
      : requests.length;

  // New rows land at the top of the list, so only those still above the
  // viewport count as unseen; the badge shrinks as the user scrolls up.
  const unseenNewCount = Math.min(pendingNewCount, scrollTop);
  const centerValue = following
    ? "Following"
    : unseenNewCount > 0
      ? `${unseenNewCount} new`
      : undefined;
  const centerColour = following ? "green" : "cyan";

  return (
    <Panel
      title="[1] Requests"
      rightValue={rightValue}
      centerValue={centerValue}
      centerColour={centerColour}
      isActive={isActive}
      isHovered={isHovered}
      width={width}
      height={height}
      onMouseDown={onActivate}
      onWheel={handleWheel}
      onMouseOver={() => onHoverChange(true)}
      onMouseOut={() => onHoverChange(false)}
    >
      {requests.length === 0 ? (
        <EmptyState />
      ) : (
        <scrollbox
          ref={ref}
          flexGrow={1}
          flexBasis={0}
          minHeight={0}
          viewportCulling
          scrollbarOptions={{ visible: false }}
          contentOptions={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1 }}
        >
          {requests.map((request, index) => (
            <RequestRow
              key={request.id}
              request={request}
              isSelected={index === selectedIndex}
              width={width - 4}
              showFullUrl={showFullUrl}
              searchTerm={searchTerm}
              index={index}
              onSelect={onSelectIndex}
            />
          ))}
        </scrollbox>
      )}
    </Panel>
  );
}
