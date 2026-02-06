import { Command } from "commander";
import {
  isDaemonRunning,
  restartDaemon,
  startDaemon,
  getDaemonVersion,
} from "../../shared/daemon.js";
import { parseVerbosity } from "../../shared/logger.js";
import { getHtpxVersion } from "../../shared/version.js";
import { requireProjectRoot, getErrorMessage } from "./helpers.js";

export const restartCommand = new Command("restart")
  .description("Restart the daemon")
  .action(async (_, command: Command) => {
    const globalOpts = command.optsWithGlobals() as { verbose?: number };
    const verbosity = globalOpts.verbose ?? 0;
    const logLevel = parseVerbosity(verbosity);

    const projectRoot = requireProjectRoot();

    try {
      const cliVersion = getHtpxVersion();

      if (await isDaemonRunning(projectRoot)) {
        const daemonVersion = await getDaemonVersion(projectRoot);
        const versionInfo =
          daemonVersion && daemonVersion !== cliVersion
            ? ` (${daemonVersion} -> ${cliVersion})`
            : "";

        console.log(`Restarting daemon${versionInfo}...`);
        const port = await restartDaemon(projectRoot, logLevel);
        console.log(`Daemon restarted on port ${port}`);
      } else {
        console.log("Daemon not running, starting...");
        const port = await startDaemon(projectRoot, { logLevel });
        console.log(`Daemon started on port ${port}`);
      }
    } catch (err) {
      console.error(`Failed to restart daemon: ${getErrorMessage(err)}`);
      process.exit(1);
    }
  });
