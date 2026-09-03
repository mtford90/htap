/** @jsxImportSource @opentui/react */

/**
 * Full-screen collapsible tree view of a JSON body.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKeyboard } from "@opentui/react";
import {
  buildBreadcrumb,
  buildVisibleNodes,
  collapseAll,
  defaultExpansion,
  expandAll,
  filterByPath,
  getValueAtPath,
  parentPath,
  toggleNode,
  type JsonTreeNode,
} from "../utils/json-tree.js";
import { formatSize } from "../utils/formatters.js";
import { copyToClipboard } from "../utils/clipboard.js";
import { Hints, type HintItem } from "./Hints.js";
import { buildBottomBorder, buildDivider, buildModalHeader } from "./panel-chrome.js";
import { attributes, DIM } from "./styles.js";

const JSON_EXPLORER_HINTS: HintItem[] = [
  { key: "j/k", action: "nav" },
  { key: "^f/^b", action: "page" },
  { key: "Enter/l", action: "toggle" },
  { key: "h", action: "collapse" },
  { key: "e/c", action: "expand/collapse all" },
  { key: "/", action: "filter" },
  { key: "n/N", action: "match" },
  { key: "y", action: "copy" },
  { key: "q/Esc", action: "close" },
];

const STATUS_MESSAGE_TIMEOUT_MS = 3000;
const FILTER_DEBOUNCE_MS = 150;
/** Title, breadcrumb and divider. */
const HEADER_ROWS = 3;
/** Divider and hint bar. */
const FOOTER_ROWS = 2;
const INDENT_SIZE = 2;

const PrimitiveValue = React.memo(function PrimitiveValue({
  value,
  isCursor,
}: {
  value: string;
  isCursor: boolean;
}): React.ReactNode {
  const bold = attributes({ bold: isCursor });
  if (value === "null") {
    return <span attributes={attributes({ dim: true, bold: isCursor })}>null</span>;
  }
  if (value === "true" || value === "false") {
    return (
      <span fg="magenta" attributes={bold}>
        {value}
      </span>
    );
  }
  return (
    <span fg={value.startsWith('"') ? "green" : "yellow"} attributes={bold}>
      {value}
    </span>
  );
});

const TreeNodeRow = React.memo(function TreeNodeRow({
  node,
  isCursor,
  isMatch,
  isExpanded,
  maxWidth,
}: {
  node: JsonTreeNode;
  isCursor: boolean;
  isMatch: boolean;
  isExpanded: boolean | undefined;
  maxWidth: number;
}): React.ReactNode {
  const indent = " ".repeat(node.depth * INDENT_SIZE);
  const cursor = isCursor ? "❯ " : "  ";
  const arrow = node.expandable ? (isExpanded ? "▼ " : "▶ ") : "  ";

  const prefix = `${cursor}${indent}${arrow}`;
  const fullLine = `${node.key}: ${node.value}`;
  const availableWidth = maxWidth - prefix.length;

  if (fullLine.length > availableWidth) {
    return (
      <text wrapMode="none" attributes={attributes({ bold: isCursor })}>
        {`${prefix}${fullLine.substring(0, Math.max(0, availableWidth - 1))}…`}
      </text>
    );
  }

  return (
    <text wrapMode="none">
      <span attributes={attributes({ bold: isCursor })}>{prefix}</span>
      <span fg="cyan" attributes={attributes({ bold: isCursor, underline: isMatch })}>
        {node.key}
      </span>
      <span attributes={attributes({ bold: isCursor })}>: </span>
      {node.type === "primitive" ? (
        <PrimitiveValue value={node.value} isCursor={isCursor} />
      ) : (
        <span attributes={attributes({ dim: true, bold: isCursor })}>{node.value}</span>
      )}
    </text>
  );
});

export interface JsonExplorerModalProps {
  data: unknown;
  title: string;
  contentType: string;
  bodySize: number;
  width: number;
  height: number;
  onClose: () => void;
  onStatus?: (message: string) => void;
}

export function JsonExplorerModal({
  data,
  title,
  contentType,
  bodySize,
  width,
  height,
  onClose,
  onStatus,
}: JsonExplorerModalProps): React.ReactNode {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => defaultExpansion(data));
  const [cursorIndex, setCursorIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [filterText, setFilterText] = useState("");
  const [filterMode, setFilterMode] = useState(false);
  const [matchingPaths, setMatchingPaths] = useState<Set<string>>(new Set());
  const [preFilterExpansion, setPreFilterExpansion] = useState<Set<string> | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | undefined>();

  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const filterDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(
    () => () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
      if (filterDebounceRef.current) {
        clearTimeout(filterDebounceRef.current);
      }
    },
    []
  );

  const showLocalStatus = useCallback((message: string) => {
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    setStatusMessage(message);
    statusTimeoutRef.current = setTimeout(
      () => setStatusMessage(undefined),
      STATUS_MESSAGE_TIMEOUT_MS
    );
  }, []);

  useEffect(() => {
    if (!filterMode) {
      return;
    }
    if (filterDebounceRef.current) {
      clearTimeout(filterDebounceRef.current);
    }

    filterDebounceRef.current = setTimeout(() => {
      const result = filterText ? filterByPath(data, filterText) : undefined;
      if (!result) {
        setMatchingPaths(new Set());
        if (preFilterExpansion) {
          setExpandedPaths(preFilterExpansion);
        }
        return;
      }

      setMatchingPaths(result.matchingPaths);
      setExpandedPaths(result.expandedPaths);
      const firstMatch = buildVisibleNodes(data, result.expandedPaths).findIndex((node) =>
        result.matchingPaths.has(node.path)
      );
      if (firstMatch !== -1) {
        setCursorIndex(firstMatch);
      }
    }, FILTER_DEBOUNCE_MS);

    return () => {
      if (filterDebounceRef.current) {
        clearTimeout(filterDebounceRef.current);
      }
    };
  }, [filterText, filterMode, data, preFilterExpansion]);

  const visibleNodes = useMemo(
    () => buildVisibleNodes(data, expandedPaths),
    [data, expandedPaths]
  );

  useEffect(() => {
    if (cursorIndex >= visibleNodes.length && visibleNodes.length > 0) {
      setCursorIndex(visibleNodes.length - 1);
    }
  }, [visibleNodes.length, cursorIndex]);

  const availableHeight = height - HEADER_ROWS - FOOTER_ROWS;

  useEffect(() => {
    if (cursorIndex < scrollOffset) {
      setScrollOffset(cursorIndex);
    } else if (cursorIndex >= scrollOffset + availableHeight) {
      setScrollOffset(cursorIndex - availableHeight + 1);
    }
  }, [cursorIndex, scrollOffset, availableHeight]);

  const cursorNode = visibleNodes[cursorIndex];
  const breadcrumb = useMemo(
    () => (cursorNode ? buildBreadcrumb(cursorNode.path) : ["(root)"]),
    [cursorNode]
  );

  /** Indices of the filter matches, used by n and N. */
  const matchIndices = useMemo(
    () =>
      visibleNodes.reduce<number[]>((indices, node, index) => {
        if (matchingPaths.has(node.path)) {
          indices.push(index);
        }
        return indices;
      }, []),
    [visibleNodes, matchingPaths]
  );

  useKeyboard((key) => {
    key.stopPropagation();

    if (filterMode) {
      if (key.name === "escape") {
        setFilterMode(false);
        setFilterText("");
        setMatchingPaths(new Set());
        if (preFilterExpansion) {
          setExpandedPaths(preFilterExpansion);
          setPreFilterExpansion(null);
        }
      } else if (key.name === "return") {
        setFilterMode(false);
      } else if (key.name === "backspace" || key.name === "delete") {
        setFilterText((previous) => previous.slice(0, -1));
      } else if (key.sequence.length === 1 && !key.ctrl && !key.meta) {
        setFilterText((previous) => previous + key.sequence);
      }
      return;
    }

    if (key.name === "escape" || key.sequence === "q") {
      onClose();
      return;
    }

    const lastIndex = Math.max(0, visibleNodes.length - 1);
    const clamp = (value: number): number => Math.min(Math.max(value, 0), lastIndex);
    const halfPage = Math.floor(availableHeight / 2);

    if (key.sequence === "j" || key.name === "down") {
      setCursorIndex((previous) => clamp(previous + 1));
    } else if (key.sequence === "k" || key.name === "up") {
      setCursorIndex((previous) => clamp(previous - 1));
    } else if (key.ctrl && key.name === "d") {
      setCursorIndex((previous) => clamp(previous + halfPage));
    } else if (key.ctrl && key.name === "u") {
      setCursorIndex((previous) => clamp(previous - halfPage));
    } else if (key.ctrl && key.name === "f") {
      setCursorIndex((previous) => clamp(previous + availableHeight));
    } else if (key.ctrl && key.name === "b") {
      setCursorIndex((previous) => clamp(previous - availableHeight));
    } else if (key.name === "return" || key.sequence === "l") {
      if (cursorNode?.expandable) {
        setExpandedPaths((previous) => toggleNode(previous, cursorNode.path));
      }
    } else if (key.sequence === "h") {
      if (!cursorNode) {
        return;
      }
      if (cursorNode.expandable && expandedPaths.has(cursorNode.path)) {
        setExpandedPaths((previous) => toggleNode(previous, cursorNode.path));
        return;
      }
      const parent = parentPath(cursorNode.path);
      const parentIndex = parent
        ? visibleNodes.findIndex((node) => node.path === parent)
        : -1;
      if (parentIndex !== -1) {
        setCursorIndex(parentIndex);
      }
    } else if (key.sequence === "g") {
      setCursorIndex(0);
    } else if (key.sequence === "G") {
      setCursorIndex(lastIndex);
    } else if (key.sequence === "/") {
      setPreFilterExpansion(new Set(expandedPaths));
      setFilterMode(true);
      setFilterText("");
    } else if (key.sequence === "e") {
      setExpandedPaths(expandAll(data));
    } else if (key.sequence === "c") {
      setExpandedPaths(collapseAll());
    } else if (key.sequence === "n" || key.sequence === "N") {
      if (matchIndices.length === 0) {
        return;
      }
      const next =
        key.sequence === "n"
          ? (matchIndices.find((index) => index > cursorIndex) ?? matchIndices[0])
          : ([...matchIndices].reverse().find((index) => index < cursorIndex) ??
            matchIndices[matchIndices.length - 1]);
      if (next !== undefined) {
        setCursorIndex(next);
      }
    } else if (key.sequence === "y" && cursorNode) {
      const value = getValueAtPath(data, cursorNode.path);
      const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
      void copyToClipboard(text).then(
        () => {
          showLocalStatus("Value copied to clipboard");
          onStatus?.("Value copied to clipboard");
        },
        () => {
          showLocalStatus("Failed to copy to clipboard");
          onStatus?.("Failed to copy to clipboard");
        }
      );
    }
  });

  const shortContentType = contentType.split(";")[0]?.trim() ?? "";
  const headerBorder = buildModalHeader(
    title,
    width,
    ` ${shortContentType} ${formatSize(bodySize)} `
  );
  const divider = buildDivider(width);
  const visibleSlice = visibleNodes.slice(scrollOffset, scrollOffset + availableHeight);

  return (
    <box flexDirection="column" width={width} height={height}>
      <text fg="cyan">{headerBorder}</text>

      <box height={1} paddingLeft={1} paddingRight={1}>
        {filterMode ? (
          <text wrapMode="none">
            <span fg="yellow">filter: </span>
            <span>{filterText}</span>
            <span fg="gray">█</span>
          </text>
        ) : (
          <text wrapMode="none" attributes={DIM}>
            {breadcrumb.join(" > ")}
          </text>
        )}
      </box>

      <text fg="cyan">{divider}</text>

      <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingRight={1}>
        {visibleSlice.map((node, index) => (
          <TreeNodeRow
            key={node.path}
            node={node}
            isCursor={scrollOffset + index === cursorIndex}
            isMatch={matchingPaths.has(node.path)}
            isExpanded={node.expandable ? expandedPaths.has(node.path) : undefined}
            maxWidth={width - 4}
          />
        ))}
      </box>

      <text fg="cyan">{divider}</text>
      <box height={1} paddingLeft={1} paddingRight={1}>
        {statusMessage ? (
          <text wrapMode="none" fg="green">
            {statusMessage}
          </text>
        ) : (
          <Hints hints={JSON_EXPLORER_HINTS} />
        )}
      </box>
      <text fg="cyan">{buildBottomBorder(width)}</text>
    </box>
  );
}
