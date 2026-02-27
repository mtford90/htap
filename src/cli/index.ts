#!/usr/bin/env node

import { program } from "commander";
import { clearCommand } from "./commands/clear.js";
import { debugDumpCommand } from "./commands/debug-dump.js";
import { onCommand } from "./commands/on.js";
import { offCommand } from "./commands/off.js";
import { interceptorsCommand } from "./commands/interceptors.js";
import { mcpCommand } from "./commands/mcp.js";
import { projectCommand } from "./commands/project.js";
import { daemonCommand } from "./commands/daemon.js";
import { tuiCommand } from "./commands/tui.js";
import { statusCommand } from "./commands/status.js";
import { requestsCommand } from "./commands/requests.js";
import { requestCommand } from "./commands/request.js";
import { sessionsCommand } from "./commands/sessions.js";
import { browserCommand } from "./commands/browser.js";
import { completionsCommand } from "./commands/completions.js";
import { getHttapVersion } from "../shared/version.js";

program
  .name("httap")
  .description("Terminal HTTP interception toolkit")
  .version(getHttapVersion())
  .option(
    "-v, --verbose",
    "increase verbosity (use -vv or -vvv for more)",
    (_, prev: number) => prev + 1,
    0
  )
  .option("-d, --dir <path>", "override project root directory")
  .option("-c, --config <path>", "override httap data directory (no .httap appended)");

program.addCommand(browserCommand);
program.addCommand(clearCommand);
program.addCommand(debugDumpCommand);
program.addCommand(onCommand);
program.addCommand(offCommand);
program.addCommand(interceptorsCommand);
program.addCommand(mcpCommand);
program.addCommand(projectCommand);
program.addCommand(daemonCommand);
program.addCommand(tuiCommand);
program.addCommand(statusCommand);
program.addCommand(requestsCommand);
program.addCommand(requestCommand);
program.addCommand(sessionsCommand);
program.addCommand(completionsCommand);

program.addHelpText(
  "after",
  `
Quick start:
  httap on         Start intercepting HTTP traffic
  httap tui        Browse captured requests
  httap browser    Launch a proxied browser session

Docs: https://github.com/mtford90/httap`
);

program.parse();
