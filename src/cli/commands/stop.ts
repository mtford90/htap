import { Command } from "commander";
import { isDaemonRunning, stopDaemon } from "../../shared/daemon.js";
import { requireProjectRoot, getErrorMessage } from "./helpers.js";

export const stopCommand = new Command("stop").description("Stop the daemon").action(async () => {
  const projectRoot = requireProjectRoot();

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
    console.error(`Error stopping daemon: ${getErrorMessage(err)}`);
    process.exit(1);
  }
});
