/** @jsxImportSource @opentui/react */

/**
 * Entry point for the OpenTUI TUI.
 *
 * The installed `httap` binary (bin/httap) execs Node with the FFI flag the
 * renderer needs, so by the time this module loads the renderer's native
 * library is already available.
 */

import { CliRenderEvents, createCliRenderer, type CliRenderer } from "@opentui/core";
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

/**
 * Ceiling on how long `--ci` waits for a ready frame before giving up and
 * exiting anyway, so a stuck sync (e.g. a control socket that never resolves)
 * cannot hang a CI run forever. The happy path exits well under this via the
 * readiness signal below, never by hitting the ceiling.
 */
const CI_FALLBACK_TIMEOUT_MS = 6_000;

/**
 * Resolves once the renderer has painted a frame with the request list no
 * longer loading (data arrived, or an error was set), i.e. the first frame
 * with real content rather than an arbitrary tick of the render loop.
 */
export const waitForCiReadyFrame = (
  renderer: CliRenderer,
  store: ReturnType<typeof createTuiStore>
): Promise<void> =>
  new Promise<void>((resolve) => {
    const onFrame = (): void => {
      if (store.getState().requests.loading) {
        return;
      }
      renderer.off(CliRenderEvents.FRAME, onFrame);
      resolve();
    };
    renderer.on(CliRenderEvents.FRAME, onFrame);
  });

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
      try {
        engine.stop();
        root?.unmount();
      } finally {
        // The only call that leaves the alternate screen, restores the cursor
        // and takes stdin out of raw mode, so an earlier failure must not skip
        // it and hand back a terminal needing `reset`.
        renderer?.destroy();
      }
      logger?.info("TUI exited");
    } catch (error) {
      logger?.error(`TUI teardown failed: ${error instanceof Error ? error.stack : String(error)}`);
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
    // process itself running with a blank screen.
    exitOnCtrlC: false,
    // The TUI must fall over with its terminal rather than outliving the
    // shell that started it.
    exitSignals: ["SIGINT", "SIGTERM", "SIGHUP"],
    // A failed setup destroys the renderer before this call returns, and
    // exiting here would report that failure as a clean quit.
    onDestroy: () => {
      if (startupComplete) {
        shutdown();
      }
    },
  });
  try {
    root = createRoot(renderer);
    root.render(<App store={store} actions={actions} engine={engine} onExit={shutdown} />);
    startupComplete = true;
  } catch (error) {
    // The terminal is already in the alternate screen, so it has to be handed
    // back before the failure is reported on it.
    try {
      renderer.destroy();
    } catch (destroyError) {
      logger?.error(
        `TUI renderer teardown failed: ${destroyError instanceof Error ? destroyError.stack : String(destroyError)}`
      );
    }
    throw error;
  }

  if (paths) {
    engine.start();
  }

  if (ci && renderer) {
    const ready = waitForCiReadyFrame(renderer, store);
    const fallback = new Promise<void>((resolve) => {
      setTimeout(resolve, CI_FALLBACK_TIMEOUT_MS);
    });
    void Promise.race([ready, fallback]).then(() => shutdown());
  }
};

/**
 * Reports a failure to start on stderr and exits non-zero.
 *
 * The running session deliberately survives a stray rejection, so the
 * `unhandledRejection` listener cannot be the one to notice this.
 */
export const runTui = async (options: StartTuiOptions): Promise<void> => {
  try {
    await startTui(options);
  } catch (error) {
    const cause = error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(`httap tui failed to start: ${cause}\n`);
    process.exit(1);
  }
};
