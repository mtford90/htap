/** @jsxImportSource @opentui/react */

/**
 * Entry point for the OpenTUI TUI process.
 *
 * `httap tui` re-executes Node with the FFI flag and then runs this module, so
 * by the time it loads the renderer's native library is available.
 */

import { createCliRenderer, type CliRenderer } from "@opentui/core";
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

  let renderer: CliRenderer | undefined = undefined;
  let root: ReturnType<typeof createRoot> | undefined = undefined;
  let startupComplete = false;

  let shuttingDown = false;
  const shutdown = (code = 0): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    try {
      engine.stop();
      root?.unmount();
      renderer?.destroy();
      logger?.info("TUI exited");
    } catch (error) {
      logger?.error(
        `TUI teardown failed: ${error instanceof Error ? error.stack : String(error)}`
      );
    } finally {
      try {
        // Buffered lines are only written synchronously on close, and the exit
        // below lands in the same tick.
        logger?.close();
      } finally {
        // OpenTUI can leave the stdin handle registered, which would keep the
        // event loop alive after the renderer is gone.
        process.exit(code);
      }
    }
  };

  for (const signal of ["SIGHUP", "SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => shutdown());
  }

  // OpenTUI installs its own handler that only logs, which would otherwise
  // leave a half-drawn alternate screen and a live process after a crash.
  process.on("uncaughtException", (error: unknown) => {
    logger?.error(`TUI crashed: ${error instanceof Error ? error.stack : String(error)}`);
    shutdown(1);
  });

  // A stray rejection is not worth the session: it leaves the screen intact.
  process.on("unhandledRejection", (reason: unknown) => {
    logger?.error(
      `Unhandled rejection: ${reason instanceof Error ? reason.stack : String(reason)}`
    );
  });

  // OpenTUI registers its signal handlers inside the renderer constructor, so
  // onDestroy can fire before this call returns.
  renderer = await createCliRenderer({
    // Ctrl+C is a command in the table instead: OpenTUI's own handler only
    // destroys the renderer, which would leave the sync engine polling and the
    // parent blocked in spawnSync.
    exitOnCtrlC: false,
    // The TUI runs in a child process, so it must fall over with its terminal
    // rather than outliving the shell that started it.
    exitSignals: ["SIGINT", "SIGTERM", "SIGHUP"],
    // A failed setup destroys the renderer before this call returns, and
    // exiting here would report that failure as a clean quit.
    onDestroy: () => {
      if (startupComplete) {
        shutdown();
      }
    },
  });
  root = createRoot(renderer);

  root.render(<App store={store} actions={actions} engine={engine} onExit={shutdown} />);
  startupComplete = true;

  if (paths) {
    engine.start();
  }

  if (ci) {
    setTimeout(shutdown, CI_EXIT_DELAY_MS);
  }
};
