/**
 * The keyboard command table.
 *
 * Every binding is one entry keyed by the modes it applies in, so the hints a
 * mode shows and the dispatcher are generated from the same source and cannot
 * drift apart. Handlers read the store synchronously, which is why none of
 * them needs a React closure.
 */

import { currentMode } from "../store/store.js";
import type { Mode, TuiState } from "../store/types.js";
import { matchesAnyKey, type KeyLike } from "./keys.js";
import { BROWSE_COMMANDS } from "./browse.js";
import { EXPORT_VIEW_COMMANDS } from "./export-view.js";
import { JSON_VIEW_COMMANDS } from "./json-view.js";
import { LOG_VIEW_COMMANDS } from "./log-view.js";
import { TEXT_VIEW_COMMANDS } from "./text-view.js";
import { appliesInMode, type Command, type CommandDeps, type CommandHint } from "./types.js";

export { focusedBody, hasBinaryBody, hasExportableBody } from "./browse.js";
export type { Command, CommandContext, CommandDeps, CommandHint } from "./types.js";

const SHORT_REQUEST_ID_LENGTH = 7;

const HELP_COMMANDS: readonly Command[] = [
  {
    id: "help.close",
    keys: ["?", "escape"],
    modes: ["help"],
    run: (context) => context.actions.closeModal(),
  },
];

const FILTER_COMMANDS: readonly Command[] = [
  {
    id: "filter.close",
    keys: ["return"],
    modes: ["filter"],
    run: (context) => context.actions.closeFilter(),
  },
  {
    id: "filter.cancel",
    keys: ["escape"],
    modes: ["filter"],
    run: (context) => {
      const origin = context.state.ui.filterDraftOrigin;
      if (origin) {
        context.engine.setFilter(origin.filter, origin.bodySearch);
        context.actions.resetToFollow();
      }
      context.actions.closeFilter();
    },
  },
];

export const COMMANDS: readonly Command[] = [
  ...BROWSE_COMMANDS,
  ...FILTER_COMMANDS,
  ...TEXT_VIEW_COMMANDS,
  ...JSON_VIEW_COMMANDS,
  ...LOG_VIEW_COMMANDS,
  ...EXPORT_VIEW_COMMANDS,
  ...HELP_COMMANDS,
];

/** A prompt shows the hints of the view it belongs to, as it did before. */
const HINT_MODE: Partial<Record<Mode, Mode>> = {
  textSearch: "text",
  jsonFilter: "json",
  logFilter: "interceptorLog",
  exportPath: "bodyExport",
};

/** Hints for the current mode, in table order. */
export const visibleHints = (state: TuiState): CommandHint[] => {
  const mode = currentMode(state);
  const hintMode = HINT_MODE[mode] ?? mode;
  return COMMANDS.filter((command) => appliesInMode(command, hintMode))
    .map((command) => command.hint)
    .filter(
      (hint): hint is CommandHint => hint !== undefined && (!hint.visible || hint.visible(state))
    );
};

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
      deps.actions.flashStatus(
        success ? "Requests cleared (bookmarks preserved)" : "Failed to clear requests"
      );
    });
    return;
  }

  deps.actions.setStatusMessage("Replaying...");
  void deps.engine
    .replay(confirm.requestId)
    .then((requestId) => {
      deps.actions.flashStatus(
        requestId
          ? `Replayed as ${requestId.slice(0, SHORT_REQUEST_ID_LENGTH)}`
          : "Failed to replay"
      );
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      deps.actions.flashStatus(`Failed to replay: ${message}`);
    });
};

/**
 * Routes one key press. Returns true when a command handled it, so the caller
 * can stop the event reaching a focused input.
 */
export const dispatchKey = (deps: CommandDeps, key: KeyLike): boolean => {
  const state = deps.store.getState();

  const globalCommand = COMMANDS.find((entry) => entry.global && matchesAnyKey(key, entry.keys));
  if (globalCommand) {
    globalCommand.run({ ...deps, state, key });
    return true;
  }

  const mode = currentMode(state);

  if (mode === "browse" && state.ui.confirm !== null) {
    runConfirm(deps, state, key);
    return true;
  }

  const command = COMMANDS.find(
    (entry) => appliesInMode(entry, mode) && matchesAnyKey(key, entry.keys)
  );
  if (!command) {
    return false;
  }

  command.run({ ...deps, state, key });
  return true;
};
