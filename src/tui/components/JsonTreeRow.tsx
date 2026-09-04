/** @jsxImportSource @opentui/react */

/**
 * One row of the JSON explorer's tree.
 */

import React from "react";
import type { JsonTreeNode } from "../utils/json-tree.js";
import { attributes } from "./styles.js";

const INDENT_SIZE = 2;

/** Stable id so the scrollbox can bring the row under the cursor into view. */
export const nodeRowId = (path: string): string => `json-node-${path}`;

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

export const TreeNodeRow = React.memo(function TreeNodeRow({
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
      <text
        id={nodeRowId(node.path)}
        height={1}
        flexShrink={0}
        wrapMode="none"
        attributes={attributes({ bold: isCursor })}
      >
        {`${prefix}${fullLine.substring(0, Math.max(0, availableWidth - 1))}…`}
      </text>
    );
  }

  return (
    <text id={nodeRowId(node.path)} height={1} flexShrink={0} wrapMode="none">
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
