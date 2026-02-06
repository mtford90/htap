import { Command } from "commander";
import { getHtpxPaths } from "../../shared/project.js";
import { isDaemonRunning } from "../../shared/daemon.js";
import { ControlClient } from "../../shared/control-client.js";
import { requireProjectRoot, getErrorMessage } from "./helpers.js";

export const statusCommand = new Command("status")
  .description("Show daemon status")
  .action(async () => {
    const projectRoot = requireProjectRoot();
    const paths = getHtpxPaths(projectRoot);

    // Check if daemon is running
    const running = await isDaemonRunning(projectRoot);
    if (!running) {
      console.log("Daemon is not running");
      process.exit(0);
    }

    try {
      // Query daemon for status
      const client = new ControlClient(paths.controlSocketFile);
      const status = await client.status();

      console.log("Daemon is running");
      console.log(`  Proxy port: ${status.proxyPort}`);
      console.log(`  Sessions: ${status.sessionCount}`);
      console.log(`  Requests captured: ${status.requestCount}`);
    } catch (err) {
      console.error(`Error querying daemon: ${getErrorMessage(err)}`);
      process.exit(1);
    }
  });
