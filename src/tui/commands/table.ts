/**
 * The keyboard command table for the main view.
 *
 * Every binding is one entry, so the status-bar hints and the dispatcher are
 * generated from the same source and cannot drift apart. Handlers read the
 * store synchronously, which is why none of them needs a React closure.
 */

import type { SyncEngine } from "../sync/engine.js";
import { selectedSummary, type TuiActions, type TuiStore } from "../store/store.js";
import {
  SECTION_REQUEST,
  SECTION_REQUEST_BODY,
  SECTION_RESPONSE,
  SECTION_RESPONSE_BODY,
  type BodyType,
  type TuiState,
} from "../store/types.js";
import { isBinaryContent } from "../utils/binary.js";
import { isJsonContent } from "../utils/content-type.js";
import { matchesAnyKey, type KeyLike } from "./keys.js";

const SHORT_REQUEST_ID_LENGTH = 7;
const RATIO_STEP = 0.05;

export interface CommandDeps {
  store: TuiStore;
  actions: TuiActions;
  engine: SyncEngine;
  /** Shows a transient message in the status bar. */
  showStatus: (message: string) => void;
  exit: () => void;
  copyToClipboard: (text: string) => Promise<void>;
}

export interface CommandContext extends CommandDeps {
  state: TuiState;
}

export interface CommandHint {
  key: string;
  action: string;
  /** Omitted hints are always shown. */
  visible?: (state: TuiState) => boolean;
}

export interface Command {
  id: string;
  keys: readonly string[];
  hint?: CommandHint;
  /** Global commands run in every mode, even with a modal or the filter bar open. */
  global?: boolean;
  run: (context: CommandContext) => void;
}

// --- helpers ---------------------------------------------------------------

const isBodySection = (section: number): boolean =>
  section === SECTION_REQUEST_BODY || section === SECTION_RESPONSE_BODY;

interface FocusedBody {
  bodyType: BodyType;
  body: Buffer | undefined;
  contentType: string | undefined;
  truncated: boolean | undefined;
}

/** The body behind the focused detail section, or undefined elsewhere. */
export const focusedBody = (state: TuiState): FocusedBody | undefined => {
  const request = state.detail.request;
  const { activePanel, focusedSection } = state.selection;
  if (!request || activePanel !== "detail" || !isBodySection(focusedSection)) {
    return undefined;
  }

  return focusedSection === SECTION_REQUEST_BODY
    ? {
        bodyType: "request",
        body: request.requestBody,
        contentType: request.requestHeaders["content-type"],
        truncated: request.requestBodyTruncated,
      }
    : {
        bodyType: "response",
        body: request.responseBody,
        contentType: request.responseHeaders?.["content-type"],
        truncated: request.responseBodyTruncated,
      };
};

/** A body is exportable when it was captured whole and is not empty. */
export const hasExportableBody = (state: TuiState): boolean => {
  const focused = focusedBody(state);
  return Boolean(focused && !focused.truncated && focused.body && focused.body.length > 0);
};

export const hasBinaryBody = (state: TuiState): boolean => {
  const focused = focusedBody(state);
  return Boolean(focused && isBinaryContent(focused.body, focused.contentType).isBinary);
};

const hasSelection = (state: TuiState): boolean => state.detail.request !== null;
const hasRequests = (state: TuiState): boolean => state.requests.items.length > 0;

const halfPage = (state: TuiState): number => Math.floor(state.viewport.contentHeight / 2);
const fullPage = (state: TuiState): number => state.viewport.contentHeight;

/** j/k move the cursor in the list and the focus in the detail pane. */
const navigate = (context: CommandContext, listDelta: number, sectionDelta: number): void => {
  if (context.state.selection.activePanel === "list") {
    context.actions.moveSelectionBy(listDelta);
  } else {
    context.actions.moveSectionBy(sectionDelta);
  }
};

/** The page keys only apply to the list; the detail sections are too few to page. */
const pageList = (context: CommandContext, delta: number): void => {
  if (context.state.selection.activePanel === "list") {
    context.actions.moveSelectionBy(delta);
  }
};

const openBodyViewer = (context: CommandContext): void => {
  const focused = focusedBody(context.state);
  const body = focused?.body;
  if (!focused || !body || body.length === 0) {
    return;
  }

  const title = focused.bodyType === "request" ? "Request Body" : "Response Body";
  const contentType = focused.contentType ?? "";
  const text = body.toString("utf-8");

  if (isJsonContent(focused.contentType)) {
    try {
      const data = JSON.parse(text) as unknown;
      context.actions.openModal({ kind: "json", data, title, contentType, bodySize: body.length });
      return;
    } catch {
      // Malformed JSON still reads fine in the text viewer.
    }
  }

  if (!isBinaryContent(body, focused.contentType).isBinary) {
    context.actions.openModal({ kind: "text", text, title, contentType, bodySize: body.length });
  }
};

const copyFocusedBody = (context: CommandContext): void => {
  const focused = focusedBody(context.state);
  if (!focused) {
    return;
  }
  if (!hasExportableBody(context.state)) {
    context.showStatus("No body to copy");
    return;
  }
  if (hasBinaryBody(context.state)) {
    context.showStatus("Cannot copy binary content — use 's' to export");
    return;
  }

  const body = focused.body;
  if (!body) {
    return;
  }
  void context.copyToClipboard(body.toString("utf-8")).then(
    () => context.showStatus("Body copied to clipboard"),
    () => context.showStatus("Failed to copy to clipboard")
  );
};

const toggleBookmark = (context: CommandContext): void => {
  const summary = selectedSummary(context.state);
  if (!summary) {
    context.showStatus("No request selected");
    return;
  }
  const currentlySaved = summary.saved === true;
  void context.engine.toggleSaved(summary.id, currentlySaved).then((success) => {
    context.showStatus(
      success ? (currentlySaved ? "Bookmark removed" : "Bookmarked") : "Failed to toggle bookmark"
    );
  });
};

// --- the table -------------------------------------------------------------

export const COMMANDS: readonly Command[] = [
  {
    id: "nav.down",
    keys: ["j", "down"],
    hint: { key: "j/k", action: "nav" },
    run: (context) => navigate(context, 1, 1),
  },
  { id: "nav.up", keys: ["k", "up"], run: (context) => navigate(context, -1, -1) },
  {
    id: "nav.first",
    keys: ["g"],
    run: (context) => {
      if (context.state.selection.activePanel === "list") {
        context.actions.resetToFollow();
      } else {
        context.actions.focusSection(SECTION_REQUEST);
      }
    },
  },
  {
    id: "nav.last",
    keys: ["G"],
    run: (context) => {
      if (context.state.selection.activePanel === "list") {
        context.actions.jumpToLast();
      } else {
        context.actions.focusSection(SECTION_RESPONSE_BODY);
      }
    },
  },
  {
    id: "nav.halfPageUp",
    keys: ["ctrl+u"],
    run: (context) => pageList(context, -halfPage(context.state)),
  },
  {
    id: "nav.halfPageDown",
    keys: ["ctrl+d"],
    run: (context) => pageList(context, halfPage(context.state)),
  },
  {
    id: "nav.pageDown",
    keys: ["ctrl+f"],
    run: (context) => pageList(context, fullPage(context.state)),
  },
  {
    id: "nav.pageUp",
    keys: ["ctrl+b"],
    run: (context) => pageList(context, -fullPage(context.state)),
  },
  {
    id: "panel.next",
    keys: ["tab"],
    hint: { key: "Tab", action: "panel" },
    run: (context) => context.actions.cycleFocus(false),
  },
  { id: "panel.prev", keys: ["shift+tab"], run: (context) => context.actions.cycleFocus(true) },
  { id: "panel.list", keys: ["1"], run: (context) => context.actions.setActivePanel("list") },
  {
    id: "panel.request",
    keys: ["2"],
    run: (context) => context.actions.focusSection(SECTION_REQUEST),
  },
  {
    id: "panel.requestBody",
    keys: ["3"],
    run: (context) => context.actions.focusSection(SECTION_REQUEST_BODY),
  },
  {
    id: "panel.response",
    keys: ["4"],
    run: (context) => context.actions.focusSection(SECTION_RESPONSE),
  },
  {
    id: "panel.responseBody",
    keys: ["5"],
    run: (context) => context.actions.focusSection(SECTION_RESPONSE_BODY),
  },
  {
    id: "section.toggle",
    keys: ["space"],
    hint: { key: "Space", action: "toggle", visible: hasSelection },
    run: (context) => {
      if (context.state.selection.activePanel === "detail") {
        context.actions.toggleSection(context.state.selection.focusedSection);
      }
    },
  },
  {
    id: "layout.shrink",
    keys: ["["],
    hint: { key: "[ ]", action: "resize", visible: hasSelection },
    run: (context) => context.actions.resizeListBy(-RATIO_STEP),
  },
  { id: "layout.grow", keys: ["]"], run: (context) => context.actions.resizeListBy(RATIO_STEP) },
  { id: "layout.reset", keys: ["="], run: (context) => context.actions.resetListWidth() },
  {
    id: "body.view",
    keys: ["return"],
    hint: {
      key: "Enter",
      action: "view",
      visible: (state) => hasExportableBody(state) && !hasBinaryBody(state),
    },
    run: openBodyViewer,
  },
  {
    id: "request.export",
    keys: ["e"],
    hint: { key: "e", action: "export", visible: hasSelection },
    run: (context) => {
      if (context.state.detail.request) {
        context.actions.openModal({ kind: "formatExport" });
      } else {
        context.showStatus("No request selected");
      }
    },
  },
  {
    id: "request.replay",
    keys: ["R"],
    hint: { key: "R", action: "replay", visible: hasSelection },
    run: (context) => {
      const summary = selectedSummary(context.state);
      if (!summary) {
        context.showStatus("No request selected");
        return;
      }
      context.actions.setConfirm({ kind: "replay", requestId: summary.id });
      context.showStatus("Replay selected request? (y to confirm, any key to cancel)");
    },
  },
  {
    id: "request.bookmark",
    keys: ["b"],
    hint: { key: "b", action: "bookmark", visible: hasSelection },
    run: toggleBookmark,
  },
  {
    id: "list.follow",
    keys: ["F"],
    hint: { key: "F", action: "follow", visible: hasRequests },
    run: (context) => context.actions.toggleFollow(),
  },
  {
    id: "requests.clear",
    keys: ["x", "D"],
    hint: { key: "x", action: "clear", visible: hasRequests },
    run: (context) => {
      if (context.state.requests.items.length === 0) {
        context.showStatus("No requests to clear");
        return;
      }
      context.actions.setConfirm({ kind: "clear" });
      context.showStatus("Clear all requests? (y to confirm, any key to cancel)");
    },
  },
  {
    id: "list.toggleUrl",
    keys: ["u"],
    hint: { key: "u", action: "URL" },
    run: (context) => {
      const showFullUrl = context.actions.toggleFullUrl();
      context.showStatus(showFullUrl ? "Showing full URL" : "Showing path only");
    },
  },
  {
    id: "filter.open",
    keys: ["/"],
    hint: { key: "/", action: "filter" },
    run: (context) => context.actions.setFilterOpen(true),
  },
  {
    id: "help.open",
    keys: ["?"],
    hint: { key: "?", action: "help" },
    run: (context) => context.actions.openModal({ kind: "help" }),
  },
  {
    id: "app.quit",
    keys: ["q"],
    hint: { key: "q", action: "quit" },
    run: (context) => context.exit(),
  },
  {
    id: "app.interrupt",
    keys: ["ctrl+c"],
    global: true,
    run: (context) => context.exit(),
  },
  {
    id: "requests.refresh",
    keys: ["r"],
    run: (context) => {
      void context.engine.refresh();
      context.showStatus("Refreshing...");
    },
  },
  {
    id: "interceptors.log",
    keys: ["L"],
    run: (context) => context.actions.openModal({ kind: "interceptorLog" }),
  },
  { id: "body.copy", keys: ["y"], run: copyFocusedBody },
  {
    id: "body.export",
    keys: ["s"],
    run: (context) => {
      const focused = focusedBody(context.state);
      if (!focused) {
        return;
      }
      if (hasExportableBody(context.state)) {
        context.actions.openModal({ kind: "bodyExport", bodyType: focused.bodyType });
      } else {
        context.showStatus("No body to export");
      }
    },
  },
];

/** Status-bar hints for the current state, in table order. */
export const visibleHints = (state: TuiState): CommandHint[] =>
  COMMANDS.map((command) => command.hint).filter(
    (hint): hint is CommandHint => hint !== undefined && (!hint.visible || hint.visible(state))
  );

/**
 * Resolves a pending confirmation: 'y' runs it, anything else cancels.
 */
const runConfirm = (deps: CommandDeps, state: TuiState, key: KeyLike): void => {
  const confirm = state.ui.confirm;
  deps.actions.setConfirm(null);

  if (key.sequence !== "y" || !confirm) {
    deps.actions.setStatusMessage(undefined);
    return;
  }

  if (confirm.kind === "clear") {
    deps.actions.resetToFollow();
    void deps.engine.clear().then((success) => {
      deps.showStatus(
        success ? "Requests cleared (bookmarks preserved)" : "Failed to clear requests"
      );
    });
    return;
  }

  deps.actions.setStatusMessage("Replaying...");
  void deps.engine
    .replay(confirm.requestId)
    .then((requestId) => {
      deps.showStatus(
        requestId
          ? `Replayed as ${requestId.slice(0, SHORT_REQUEST_ID_LENGTH)}`
          : "Failed to replay"
      );
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      deps.showStatus(`Failed to replay: ${message}`);
    });
};

/**
 * Routes one key press. Returns true when a command handled it, so the caller
 * can stop the event reaching a focused renderable.
 */
export const dispatchKey = (deps: CommandDeps, key: KeyLike): boolean => {
  const state = deps.store.getState();

  const globalCommand = COMMANDS.find((entry) => entry.global && matchesAnyKey(key, entry.keys));
  if (globalCommand) {
    globalCommand.run({ ...deps, state });
    return true;
  }

  if (state.ui.modal !== null || state.ui.filterOpen) {
    return false;
  }

  if (state.ui.confirm !== null) {
    runConfirm(deps, state, key);
    return true;
  }

  const command = COMMANDS.find((entry) => matchesAnyKey(key, entry.keys));
  if (!command) {
    return false;
  }

  command.run({ ...deps, state });
  return true;
};
