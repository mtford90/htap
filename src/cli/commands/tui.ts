import { Command } from "commander";
import { findProjectRoot, setConfigOverride, resolveOverridePath } from "../../shared/project.js";
import { createLogger, parseVerbosity } from "../../shared/logger.js";
import { getGlobalOptions } from "./helpers.js";

export const tuiCommand = new Command("tui")
  .description("Browse captured HTTP traffic")
  .option("--ci", "CI mode: render once and exit after a short delay (for testing)")
  .action(async (options: { ci?: boolean }, command: Command) => {
    process.env["NODE_ENV"] = process.env["NODE_ENV"] ?? "production";
    const { render } = await import("ink");
    const { default: React } = await import("react");
    const { App } = await import("../tui/App.js");
    const globalOpts = getGlobalOptions(command);
    const verbosity = globalOpts.verbose;
    const logLevel = parseVerbosity(verbosity);

    if (globalOpts.config) {
      setConfigOverride(resolveOverridePath(globalOpts.config));
    }

    const projectRoot = globalOpts.config
      ? resolveOverridePath(globalOpts.config)
      : findProjectRoot(undefined, globalOpts.dir);

    // Log TUI startup
    if (projectRoot) {
      const logger = createLogger("tui", projectRoot, logLevel);
      logger.info("TUI started");
    }

    const { waitUntilExit, unmount } = render(
      React.createElement(App, { projectRoot: projectRoot ?? undefined })
    );

    // In CI mode, exit after a short delay to allow initial render
    if (options.ci) {
      setTimeout(() => {
        unmount();
      }, 500);
    }

    void waitUntilExit().then(() => {
      // Log TUI exit
      if (projectRoot) {
        const logger = createLogger("tui", projectRoot, logLevel);
        logger.info("TUI exited");
      }
    });
  });
