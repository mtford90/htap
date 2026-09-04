/**
 * Shape of one keyboard command.
 *
 * A command declares the modes it applies in, so the dispatcher and the hints
 * a mode shows are generated from the same entry and cannot drift apart.
 */

import type { SyncEngine } from "../sync/engine.js";
import type { TuiActions, TuiStore } from "../store/store.js";
import type { Mode, TuiState } from "../store/types.js";
import type { KeyLike } from "./keys.js";

export interface CommandDeps {
  store: TuiStore;
  actions: TuiActions;
  engine: SyncEngine;
  exit: () => void;
  copyToClipboard: (text: string) => Promise<void>;
}

export interface CommandContext extends CommandDeps {
  state: TuiState;
  /** The key that selected this command, for bindings covering a range. */
  key: KeyLike;
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
  /** Modes this binding applies in; the main view when omitted. */
  modes?: readonly Mode[];
  hint?: CommandHint;
  /** Global commands run in every mode, even with a modal open. */
  global?: boolean;
  run: (context: CommandContext) => void;
}

const BROWSE_MODE: readonly Mode[] = ["browse"];

export const appliesInMode = (command: Command, mode: Mode): boolean =>
  (command.modes ?? BROWSE_MODE).includes(mode);
