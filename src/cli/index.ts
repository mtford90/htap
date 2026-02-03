#!/usr/bin/env node

import { program } from "commander";
import { clearCommand } from "./commands/clear.js";
import { initCommand } from "./commands/init.js";
import { interceptCommand } from "./commands/intercept.js";
import { projectCommand } from "./commands/project.js";
import { tuiCommand } from "./commands/tui.js";
import { statusCommand } from "./commands/status.js";
import { stopCommand } from "./commands/stop.js";

program.name("htpx").description("Terminal HTTP interception toolkit").version("0.1.0");

program.addCommand(clearCommand);
program.addCommand(initCommand);
program.addCommand(interceptCommand);
program.addCommand(projectCommand);
program.addCommand(tuiCommand);
program.addCommand(statusCommand);
program.addCommand(stopCommand);

program.parse();
// test
