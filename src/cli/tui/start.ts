/**
 * Ink TUI entry, kept reachable through `HTTAP_TUI=ink` for one minor version
 * while the OpenTUI TUI settles. It will be removed with the Ink tree.
 */

import { render } from "ink";
import React from "react";
import { createLogger, parseVerbosity } from "../../shared/logger.js";
import { setConfigOverride } from "../../shared/project.js";
import { App } from "./App.js";

const CI_EXIT_DELAY_MS = 500;

export interface StartInkTuiOptions {
  projectRoot?: string;
  configOverride?: string;
  ci: boolean;
  verbose: number;
}

export const startInkTui = async ({
  projectRoot,
  configOverride,
  ci,
  verbose,
}: StartInkTuiOptions): Promise<void> => {
  if (configOverride) {
    setConfigOverride(configOverride);
  }

  const logLevel = parseVerbosity(verbose);
  if (projectRoot) {
    createLogger("tui", projectRoot, logLevel).info("TUI started");
  }

  const { waitUntilExit, unmount } = render(React.createElement(App, { projectRoot }));

  if (ci) {
    setTimeout(unmount, CI_EXIT_DELAY_MS);
  }

  await waitUntilExit();

  if (projectRoot) {
    createLogger("tui", projectRoot, logLevel).info("TUI exited");
  }
};
