/** @jsxImportSource @opentui/react */

/**
 * Full-screen collapsible tree view of a JSON body. The scrollbox owns the
 * viewport and the command table owns every key; the only logic left here is
 * the debounce that turns typed filter text into matches.
 */

import React, { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { visibleHints } from "../commands/table.js";
import { useScroller } from "../hooks/useScroller.js";
import type { TuiActions, TuiStore } from "../store/store.js";
import { buildBreadcrumb, buildVisibleNodes, filterByPath } from "../utils/json-tree.js";
import { formatSize } from "../utils/formatters.js";
import { Hints } from "./Hints.js";
import { buildBottomBorder, buildDivider, buildModalHeader } from "./panel-chrome.js";
import { nodeRowId, TreeNodeRow } from "./JsonTreeRow.js";
import { DIM } from "./styles.js";

const FILTER_DEBOUNCE_MS = 150;
const FILTER_FIELD_WIDTH = 40;

export interface JsonExplorerModalProps {
  store: TuiStore;
  actions: TuiActions;
  data: unknown;
  title: string;
  contentType: string;
  bodySize: number;
  width: number;
  height: number;
}

export function JsonExplorerModal({
  store,
  actions,
  data,
  title,
  contentType,
  bodySize,
  width,
  height,
}: JsonExplorerModalProps): React.ReactNode {
  const { cursorIndex, expandedPaths, matchingPaths, filterOpen, filterText } = useStore(
    store,
    useShallow((state) => state.modals.json)
  );
  const statusMessage = useStore(store, (state) => state.ui.statusMessage);
  const hints = useStore(store, useShallow(visibleHints));
  const { ref } = useScroller("json", actions);

  const visibleNodes = useMemo(() => buildVisibleNodes(data, expandedPaths), [data, expandedPaths]);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!filterOpen) {
      return;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      const result = filterText ? filterByPath(data, filterText) : undefined;
      if (!result) {
        const { preFilterExpansion, expandedPaths: current } = store.getState().modals.json;
        actions.patchJsonView({
          matchingPaths: new Set<string>(),
          expandedPaths: preFilterExpansion ?? current,
        });
        return;
      }
      const firstMatch = buildVisibleNodes(data, result.expandedPaths).findIndex((node) =>
        result.matchingPaths.has(node.path)
      );
      actions.patchJsonView({
        matchingPaths: result.matchingPaths,
        expandedPaths: result.expandedPaths,
        ...(firstMatch === -1 ? {} : { cursorIndex: firstMatch }),
      });
    }, FILTER_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [filterText, filterOpen, data, store, actions]);

  // Collapsing a node can leave the cursor past the end of the tree.
  useEffect(() => {
    if (cursorIndex >= visibleNodes.length && visibleNodes.length > 0) {
      actions.patchJsonView({ cursorIndex: visibleNodes.length - 1 });
    }
  }, [visibleNodes.length, cursorIndex, actions]);

  const cursorNode = visibleNodes[cursorIndex];
  const cursorPath = cursorNode?.path;
  useEffect(() => {
    if (cursorPath !== undefined) {
      ref.current?.scrollChildIntoView(nodeRowId(cursorPath));
    }
  }, [cursorPath, visibleNodes, ref]);

  const breadcrumb = useMemo(
    () => (cursorNode ? buildBreadcrumb(cursorNode.path) : ["(root)"]),
    [cursorNode]
  );

  const shortContentType = contentType.split(";")[0]?.trim() ?? "";
  const headerBorder = buildModalHeader(
    title,
    width,
    ` ${shortContentType} ${formatSize(bodySize)} `
  );
  const divider = buildDivider(width);

  return (
    <box flexDirection="column" width={width} height={height}>
      <text fg="cyan">{headerBorder}</text>

      <box height={1} flexShrink={0} paddingLeft={1} paddingRight={1} flexDirection="row">
        {filterOpen ? (
          <>
            <text wrapMode="none">
              <span fg="yellow">filter: </span>
            </text>
            <input
              focused
              value=""
              onInput={(value) => actions.patchJsonView({ filterText: value })}
              width={FILTER_FIELD_WIDTH}
              flexShrink={0}
            />
          </>
        ) : (
          <text wrapMode="none" attributes={DIM}>
            {breadcrumb.join(" > ")}
          </text>
        )}
      </box>

      <text fg="cyan">{divider}</text>

      <scrollbox
        ref={ref}
        flexGrow={1}
        flexBasis={0}
        minHeight={0}
        viewportCulling
        scrollbarOptions={{ visible: false }}
        contentOptions={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1 }}
      >
        {visibleNodes.map((node, index) => (
          <TreeNodeRow
            key={node.path}
            node={node}
            isCursor={index === cursorIndex}
            isMatch={matchingPaths.has(node.path)}
            isExpanded={node.expandable ? expandedPaths.has(node.path) : undefined}
            maxWidth={width - 4}
          />
        ))}
      </scrollbox>

      <text fg="cyan">{divider}</text>
      <box height={1} flexShrink={0} paddingLeft={1} paddingRight={1}>
        {statusMessage ? (
          <text wrapMode="none" fg="green">
            {statusMessage}
          </text>
        ) : (
          <Hints hints={hints} />
        )}
      </box>
      <text fg="cyan">{buildBottomBorder(width)}</text>
    </box>
  );
}
