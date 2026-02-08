import { Command } from "commander";
import { ensureHtpxDir, findOrCreateProjectRoot, getHtpxDir } from "../../shared/project.js";
import { getGlobalOptions } from "./helpers.js";

export const projectCommand = new Command("project").description(
  "Manage htpx project configuration"
);

projectCommand
  .command("init")
  .description("Initialise htpx in the current directory")
  .action((_, command: Command) => {
    const globalOpts = getGlobalOptions(command);
    const projectRoot = findOrCreateProjectRoot(undefined, globalOpts.dir ?? process.cwd());
    const htpxDir = getHtpxDir(projectRoot);

    ensureHtpxDir(projectRoot);
    console.log(`Created ${htpxDir}`);
  });
