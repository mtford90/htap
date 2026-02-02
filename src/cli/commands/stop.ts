import { Command } from "commander";
import { findProjectRoot } from "../../shared/project.js";
import { isDaemonRunning, stopDaemon } from "../../shared/daemon.js";

export const stopCommand = new Command("stop").description("Stop the daemon").action(async () => {
  // Find project root
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    console.log("Not in a project directory (no .htpx or .git found)");
    process.exit(1);
  }

  // Check if daemon is running
  const running = await isDaemonRunning(projectRoot);
  if (!running) {
    console.log("Daemon is not running");
    process.exit(0);
  }

  try {
    await stopDaemon(projectRoot);
    console.log("Daemon stopped");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Error stopping daemon: ${message}`);
    process.exit(1);
  }
});
