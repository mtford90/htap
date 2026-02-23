import { Command } from "commander";
import { ensureProcsiDir, getProcsiDir } from "../../shared/project.js";
import { getGlobalOptions, resolveProjectContext } from "./helpers.js";

export const projectCommand = new Command("project").description(
  "Manage procsi project configuration"
);

projectCommand
  .command("init")
  .description("Initialise procsi in the current directory")
  .action((_, command: Command) => {
    const globalOpts = getGlobalOptions(command);
    if (!globalOpts.dir && !globalOpts.config) {
      globalOpts.dir = process.cwd();
    }
    const projectRoot = resolveProjectContext(globalOpts);
    const procsiDir = getProcsiDir(projectRoot);

    ensureProcsiDir(projectRoot);
    console.log(`Created ${procsiDir}`);
  });
