import { Command } from "commander";
import { ensureHttapDir, getHttapDir } from "../../shared/project.js";
import { getGlobalOptions, resolveProjectContext } from "./helpers.js";

export const projectCommand = new Command("project").description(
  "Manage httap project configuration"
);

projectCommand
  .command("init")
  .description("Initialise httap in the current directory")
  .action((_, command: Command) => {
    const globalOpts = getGlobalOptions(command);
    if (!globalOpts.dir && !globalOpts.config) {
      globalOpts.dir = process.cwd();
    }
    const projectRoot = resolveProjectContext(globalOpts);
    const httapDir = getHttapDir(projectRoot);

    ensureHttapDir(projectRoot);
    console.log(`Created ${httapDir}`);
  });
