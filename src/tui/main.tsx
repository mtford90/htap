/** @jsxImportSource @opentui/react */

/**
 * Entry point for the OpenTUI TUI process.
 *
 * `httap tui` re-executes Node with the FFI flag and then runs this module, so
 * by the time it loads the renderer's native library is available.
 */

import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import React from "react";
import { ControlClient } from "../shared/control-client.js";
import { createLogger, parseVerbosity } from "../shared/logger.js";
import { getHttapPaths, readProxyPort, setConfigOverride } from "../shared/project.js";
import { loadConfig } from "../shared/config.js";
import { App } from "./App.js";
import { createTuiActions, createTuiStore } from "./store/store.js";
import { SyncEngine } from "./sync/engine.js";

export interface StartTuiOptions {
  projectRoot?: string;
  /** Set when `--config` points the CLI at a different .httap directory. */
  configOverride?: string;
  /** Render one frame and exit, for smoke tests. */
  ci?: boolean;
  verbose?: number;
}

const CI_EXIT_DELAY_MS = 500;

export const startTui = async ({
  projectRoot,
  configOverride,
  ci = false,
  verbose = 0,
}: StartTuiOptions): Promise<void> => {
  if (configOverride) {
    setConfigOverride(configOverride);
  }

  const logger = projectRoot
    ? createLogger("tui", projectRoot, parseVerbosity(verbose))
    : undefined;
  logger?.info("TUI started");

  const paths = projectRoot ? getHttapPaths(projectRoot) : undefined;
  const config = projectRoot ? loadConfig(projectRoot) : undefined;

  const store = createTuiStore({
    caCertPath: paths?.caCertFile ?? "",
    proxyPort: projectRoot ? readProxyPort(projectRoot) : undefined,
  });
  const actions = createTuiActions(store);

  if (!paths) {
    actions.setError("Not in a httap project. Run 'eval \"$(httap on)\"' first.");
  }

  const engine = new SyncEngine({
    client: new ControlClient(paths?.controlSocketFile ?? ""),
    actions,
    pollInterval: config?.pollInterval,
  });

  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    // The TUI runs in a child process, so it must fall over with its terminal
    // rather than outliving the shell that started it.
    exitSignals: ["SIGINT", "SIGTERM", "SIGHUP"],
  });
  const root = createRoot(renderer);

  let shuttingDown = false;
  const shutdown = (): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    engine.stop();
    root.unmount();
    renderer.destroy();
    logger?.info("TUI exited");
    // OpenTUI can leave the stdin handle registered, which would keep the
    // event loop alive after the renderer is gone.
    process.exit(0);
  };

  for (const signal of ["SIGHUP", "SIGTERM", "SIGINT"] as const) {
    process.on(signal, shutdown);
  }

  root.render(<App store={store} actions={actions} engine={engine} onExit={shutdown} />);

  if (paths) {
    engine.start();
  }

  if (ci) {
    setTimeout(shutdown, CI_EXIT_DELAY_MS);
  }
};
