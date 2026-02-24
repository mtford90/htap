import { Command } from "commander";
import { ensureHtapDir, getHtapDir } from "../../shared/project.js";
import { getGlobalOptions, resolveProjectContext } from "./helpers.js";

export const projectCommand = new Command("project").description(
  "Manage htap project configuration"
);

projectCommand
  .command("init")
  .description("Initialise htap in the current directory")
  .action((_, command: Command) => {
    const globalOpts = getGlobalOptions(command);
    if (!globalOpts.dir && !globalOpts.config) {
      globalOpts.dir = process.cwd();
    }
    const projectRoot = resolveProjectContext(globalOpts);
    const htapDir = getHtapDir(projectRoot);

    ensureHtapDir(projectRoot);
    console.log(`Created ${htapDir}`);
  });
