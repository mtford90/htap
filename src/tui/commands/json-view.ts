/**
 * Keyboard commands of the JSON explorer and its filter prompt.
 */

import type { Mode, TuiState } from "../store/types.js";
import {
  buildVisibleNodes,
  collapseAll,
  expandAll,
  getValueAtPath,
  parentPath,
  toggleNode,
  type JsonTreeNode,
} from "../utils/json-tree.js";
import type { Command, CommandContext } from "./types.js";

const JSON_MODE: readonly Mode[] = ["json"];
const FILTER: readonly Mode[] = ["jsonFilter"];

const treeData = (state: TuiState): unknown =>
  state.ui.modal?.kind === "json" ? state.ui.modal.data : null;

const nodes = (state: TuiState): JsonTreeNode[] =>
  buildVisibleNodes(treeData(state), state.modals.json.expandedPaths);

const cursorNode = (state: TuiState): JsonTreeNode | undefined =>
  nodes(state)[state.modals.json.cursorIndex];

const page = (state: TuiState): number => state.scrollers.json?.viewportRows ?? 1;

const moveCursor = (context: CommandContext, delta: number): void => {
  const last = Math.max(0, nodes(context.state).length - 1);
  const next = Math.min(Math.max(context.state.modals.json.cursorIndex + delta, 0), last);
  context.actions.patchJsonView({ cursorIndex: next });
};

/** h collapses an open node, and otherwise climbs to its parent. */
const collapseOrAscend = (context: CommandContext): void => {
  const node = cursorNode(context.state);
  if (!node) {
    return;
  }
  const expanded = context.state.modals.json.expandedPaths;
  if (node.expandable && expanded.has(node.path)) {
    context.actions.patchJsonView({ expandedPaths: toggleNode(expanded, node.path) });
    return;
  }
  const parent = parentPath(node.path);
  const parentIndex = parent
    ? nodes(context.state).findIndex((entry) => entry.path === parent)
    : -1;
  if (parentIndex !== -1) {
    context.actions.patchJsonView({ cursorIndex: parentIndex });
  }
};

const matchIndices = (state: TuiState): number[] =>
  nodes(state).reduce<number[]>((indices, node, index) => {
    if (state.modals.json.matchingPaths.has(node.path)) {
      indices.push(index);
    }
    return indices;
  }, []);

const stepMatch = (context: CommandContext, forwards: boolean): void => {
  const indices = matchIndices(context.state);
  if (indices.length === 0) {
    return;
  }
  const cursor = context.state.modals.json.cursorIndex;
  const next = forwards
    ? (indices.find((index) => index > cursor) ?? indices[0])
    : ([...indices].reverse().find((index) => index < cursor) ?? indices[indices.length - 1]);
  if (next !== undefined) {
    context.actions.patchJsonView({ cursorIndex: next });
  }
};

export const JSON_VIEW_COMMANDS: readonly Command[] = [
  {
    id: "json.down",
    keys: ["j", "down"],
    modes: JSON_MODE,
    hint: { key: "j/k", action: "nav" },
    run: (context) => moveCursor(context, 1),
  },
  { id: "json.up", keys: ["k", "up"], modes: JSON_MODE, run: (context) => moveCursor(context, -1) },
  {
    id: "json.pageDown",
    keys: ["ctrl+f"],
    modes: JSON_MODE,
    hint: { key: "^f/^b", action: "page" },
    run: (context) => moveCursor(context, page(context.state)),
  },
  {
    id: "json.pageUp",
    keys: ["ctrl+b"],
    modes: JSON_MODE,
    run: (context) => moveCursor(context, -page(context.state)),
  },
  {
    id: "json.halfPageDown",
    keys: ["ctrl+d"],
    modes: JSON_MODE,
    run: (context) => moveCursor(context, Math.floor(page(context.state) / 2)),
  },
  {
    id: "json.halfPageUp",
    keys: ["ctrl+u"],
    modes: JSON_MODE,
    run: (context) => moveCursor(context, -Math.floor(page(context.state) / 2)),
  },
  {
    id: "json.toggle",
    keys: ["return", "l"],
    modes: JSON_MODE,
    hint: { key: "Enter/l", action: "toggle" },
    run: (context) => {
      const node = cursorNode(context.state);
      if (node?.expandable) {
        context.actions.patchJsonView({
          expandedPaths: toggleNode(context.state.modals.json.expandedPaths, node.path),
        });
      }
    },
  },
  {
    id: "json.collapse",
    keys: ["h"],
    modes: JSON_MODE,
    hint: { key: "h", action: "collapse" },
    run: collapseOrAscend,
  },
  {
    id: "json.expandAll",
    keys: ["e"],
    modes: JSON_MODE,
    hint: { key: "e/c", action: "expand/collapse all" },
    run: (context) =>
      context.actions.patchJsonView({ expandedPaths: expandAll(treeData(context.state)) }),
  },
  {
    id: "json.collapseAll",
    keys: ["c"],
    modes: JSON_MODE,
    run: (context) => context.actions.patchJsonView({ expandedPaths: collapseAll() }),
  },
  {
    id: "json.first",
    keys: ["g"],
    modes: JSON_MODE,
    run: (context) => context.actions.patchJsonView({ cursorIndex: 0 }),
  },
  {
    id: "json.last",
    keys: ["G"],
    modes: JSON_MODE,
    run: (context) =>
      context.actions.patchJsonView({ cursorIndex: Math.max(0, nodes(context.state).length - 1) }),
  },
  {
    id: "json.filter",
    keys: ["/"],
    modes: JSON_MODE,
    hint: { key: "/", action: "filter" },
    run: (context) =>
      context.actions.patchJsonView({
        filterOpen: true,
        filterText: "",
        preFilterExpansion: context.state.modals.json.expandedPaths,
      }),
  },
  {
    id: "json.nextMatch",
    keys: ["n"],
    modes: JSON_MODE,
    hint: { key: "n/N", action: "match" },
    run: (context) => stepMatch(context, true),
  },
  {
    id: "json.prevMatch",
    keys: ["N"],
    modes: JSON_MODE,
    run: (context) => stepMatch(context, false),
  },
  {
    id: "json.copy",
    keys: ["y"],
    modes: JSON_MODE,
    hint: { key: "y", action: "copy" },
    run: (context) => {
      const node = cursorNode(context.state);
      if (!node) {
        return;
      }
      const value = getValueAtPath(treeData(context.state), node.path);
      const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
      void context.copyToClipboard(text).then(
        () => context.actions.flashStatus("Value copied to clipboard"),
        () => context.actions.flashStatus("Failed to copy to clipboard")
      );
    },
  },
  {
    id: "json.close",
    keys: ["q", "escape"],
    modes: JSON_MODE,
    hint: { key: "q/Esc", action: "close" },
    run: (context) => context.actions.closeModal(),
  },
  {
    id: "jsonFilter.cancel",
    keys: ["escape"],
    modes: FILTER,
    run: (context) => {
      const { preFilterExpansion, expandedPaths } = context.state.modals.json;
      context.actions.patchJsonView({
        filterOpen: false,
        filterText: "",
        matchingPaths: new Set<string>(),
        expandedPaths: preFilterExpansion ?? expandedPaths,
        preFilterExpansion: null,
      });
    },
  },
  {
    id: "jsonFilter.submit",
    keys: ["return"],
    modes: FILTER,
    run: (context) => context.actions.patchJsonView({ filterOpen: false }),
  },
];
