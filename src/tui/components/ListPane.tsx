/** @jsxImportSource @opentui/react */

/**
 * Left panel: the window of captured requests around the cursor.
 *
 * Only the visible rows are rendered, and the window position comes from the
 * store, so a delta never has to be corrected after the frame is drawn.
 */

import React from "react";
import type { CapturedRequestSummary } from "../../shared/types.js";
import { DIM } from "./styles.js";
import { Panel } from "./Panel.js";
import { RequestRow } from "./RequestRow.js";

export interface ListPaneProps {
  requests: CapturedRequestSummary[];
  selectedIndex: number;
  scrollOffset: number;
  isActive: boolean;
  isHovered: boolean;
  width: number;
  height: number;
  showFullUrl: boolean;
  searchTerm?: string;
  following: boolean;
  pendingNewCount: number;
  onSelectIndex: (index: number) => void;
  onScroll: (delta: number) => void;
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
  scrollOffset,
  isActive,
  isHovered,
  width,
  height,
  showFullUrl,
  searchTerm,
  following,
  pendingNewCount,
  onSelectIndex,
  onScroll,
  onActivate,
  onHoverChange,
}: ListPaneProps): React.ReactNode {
  const visibleHeight = Math.max(1, height - 2);
  const visibleRequests = requests.slice(scrollOffset, scrollOffset + visibleHeight);

  const rightValue =
    requests.length > visibleHeight
      ? `${scrollOffset + 1}-${Math.min(scrollOffset + visibleHeight, requests.length)}/${requests.length}`
      : requests.length;

  // New rows land at the top of the list, so only those still above the
  // viewport count as unseen; the badge shrinks as the user scrolls up.
  const unseenNewCount = Math.min(pendingNewCount, scrollOffset);
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
      onScroll={onScroll}
      onMouseOver={() => onHoverChange(true)}
      onMouseOut={() => onHoverChange(false)}
    >
      {requests.length === 0 ? (
        <EmptyState />
      ) : (
        <box flexDirection="column" paddingLeft={1} paddingRight={1}>
          {visibleRequests.map((request, index) => {
            const absoluteIndex = scrollOffset + index;
            return (
              <RequestRow
                key={request.id}
                request={request}
                isSelected={absoluteIndex === selectedIndex}
                width={width - 4}
                showFullUrl={showFullUrl}
                searchTerm={searchTerm}
                index={absoluteIndex}
                onSelect={onSelectIndex}
              />
            );
          })}
        </box>
      )}
    </Panel>
  );
}
