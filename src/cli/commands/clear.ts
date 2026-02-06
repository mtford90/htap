import { Command } from "commander";
import { getHtpxPaths } from "../../shared/project.js";
import { isDaemonRunning } from "../../shared/daemon.js";
import { ControlClient } from "../../shared/control-client.js";
import { requireProjectRoot, getErrorMessage } from "./helpers.js";

export const clearCommand = new Command("clear")
  .description("Clear all captured requests")
  .action(async () => {
    const projectRoot = requireProjectRoot();
    const paths = getHtpxPaths(projectRoot);

    const running = await isDaemonRunning(projectRoot);
    if (!running) {
      console.log("Daemon is not running");
      process.exit(1);
    }

    try {
      const client = new ControlClient(paths.controlSocketFile);
      await client.clearRequests();
      console.log("Requests cleared");
    } catch (err) {
      console.error(`Error clearing requests: ${getErrorMessage(err)}`);
      process.exit(1);
    }
  });
