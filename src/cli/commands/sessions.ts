/**
 * `procsi sessions` — list active proxy sessions.
 */

import { Command } from "commander";
import { ControlClient } from "../../shared/control-client.js";
import { getProcsiPaths } from "../../shared/project.js";
import { isDaemonRunning } from "../../shared/daemon.js";
import { requireProjectRoot, getErrorMessage, getGlobalOptions } from "./helpers.js";
import { formatSessionTable } from "../formatters/detail.js";
import { formatHint, shouldShowHints } from "../formatters/hints.js";

export const sessionsCommand = new Command("sessions")
  .description("List active proxy sessions")
  .option("--json", "JSON output")
  .action(async (opts: { json?: boolean }, command: Command) => {
    const globalOpts = getGlobalOptions(command);
    const projectRoot = requireProjectRoot(globalOpts.dir);
    const paths = getProcsiPaths(projectRoot);

    const running = await isDaemonRunning(projectRoot);
    if (!running) {
      console.error("Daemon is not running. Start it with: procsi on");
      process.exit(1);
    }

    const client = new ControlClient(paths.controlSocketFile);
    try {
      const sessions = await client.listSessions();

      if (opts.json) {
        console.log(JSON.stringify(sessions, null, 2));
        return;
      }

      if (sessions.length === 0) {
        console.log("  No active sessions");
        return;
      }

      console.log(formatSessionTable(sessions));

      if (shouldShowHints()) {
        console.log(
          formatHint(["procsi requests to see captured traffic", "--json for JSON output"])
        );
      }
    } catch (err) {
      console.error(`Error listing sessions: ${getErrorMessage(err)}`);
      process.exit(1);
    } finally {
      client.close();
    }
  });
