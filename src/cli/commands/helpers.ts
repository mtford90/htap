import { Command } from "commander";
import {
  findProjectRoot,
  findOrCreateProjectRoot,
  getHttapPaths,
  setConfigOverride,
  getConfigOverride,
  resolveOverridePath,
} from "../../shared/project.js";
import { isDaemonRunning } from "../../shared/daemon.js";
import { ControlClient } from "../../shared/control-client.js";

export interface GlobalOptions {
  verbose: number;
  dir?: string;
  config?: string;
}

/**
 * Validate and extract global CLI options from a Commander command.
 * CLI flags take precedence over environment variables.
 */
export function getGlobalOptions(command: Command): GlobalOptions {
  const raw = command.optsWithGlobals() as Record<string, unknown>;
  return {
    verbose: typeof raw["verbose"] === "number" ? raw["verbose"] : 0,
    dir: typeof raw["dir"] === "string" ? raw["dir"] : (process.env["HTTAP_DIR"] ?? undefined),
    config:
      typeof raw["config"] === "string"
        ? raw["config"]
        : (process.env["HTTAP_CONFIG"] ?? undefined),
  };
}

/**
 * Find the project root or exit with a friendly error message.
 * When a config override is active, returns the override path as a
 * stand-in project root (getHttapDir will ignore it).
 */
export function requireProjectRoot(override?: string): string {
  const configOverride = getConfigOverride();
  if (configOverride) {
    return configOverride;
  }

  const projectRoot = findProjectRoot(undefined, override);
  if (!projectRoot) {
    if (override) {
      console.error(`No .httap or .git found at ${override} (specified via --dir)`);
    } else {
      console.error("Not in a project directory (no .httap or .git found)");
    }
    process.exit(1);
  }
  return projectRoot;
}

/**
 * Set the config override from global options and return an appropriate
 * project root. When --config is provided, the override is set and the
 * resolved config path is returned (getHttapDir will use the override).
 * Otherwise falls back to findOrCreateProjectRoot with --dir.
 */
export function resolveProjectContext(globalOpts: GlobalOptions): string {
  if (globalOpts.config) {
    const resolved = resolveOverridePath(globalOpts.config);
    setConfigOverride(resolved);
    return resolved;
  }
  return findOrCreateProjectRoot(undefined, globalOpts.dir);
}

/**
 * Extract a human-readable message from an unknown error value.
 */
export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

/**
 * Connect to the running daemon and return a ControlClient.
 * Exits with error if the daemon is not running.
 */
export async function connectToDaemon(command: Command): Promise<{
  client: ControlClient;
  projectRoot: string;
}> {
  const globalOpts = getGlobalOptions(command);

  // Set config override before any path resolution
  if (globalOpts.config) {
    setConfigOverride(resolveOverridePath(globalOpts.config));
  }

  const projectRoot = requireProjectRoot(globalOpts.dir);
  const paths = getHttapPaths(projectRoot);

  const running = await isDaemonRunning(projectRoot);
  if (!running) {
    console.error("Daemon is not running. Start it with: httap on");
    process.exit(1);
  }

  const client = new ControlClient(paths.controlSocketFile);
  return { client, projectRoot };
}
