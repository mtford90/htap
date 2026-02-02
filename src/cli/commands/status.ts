import { Command } from "commander";
import { findProjectRoot, getHtpxPaths } from "../../shared/project.js";
import { isDaemonRunning } from "../../shared/daemon.js";
import { ControlClient } from "../../daemon/control.js";

export const statusCommand = new Command("status")
  .description("Show daemon status")
  .action(async () => {
    // Find project root
    const projectRoot = findProjectRoot();
    if (!projectRoot) {
      console.log("Not in a project directory (no .htpx or .git found)");
      process.exit(1);
    }

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
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`Error querying daemon: ${message}`);
      process.exit(1);
    }
  });
