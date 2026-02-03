import { Command } from "commander";
import { ensureHtpxDir, getHtpxDir } from "../../shared/project.js";

export const projectCommand = new Command("project").description("Manage htpx project configuration");

projectCommand
  .command("init")
  .description("Initialise htpx in the current directory")
  .action(() => {
    const projectRoot = process.cwd();
    const htpxDir = getHtpxDir(projectRoot);

    ensureHtpxDir(projectRoot);
    console.log(`Created ${htpxDir}`);
  });
