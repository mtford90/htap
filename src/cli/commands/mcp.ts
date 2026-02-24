import { Command } from "commander";
import { createHtapMcpServer } from "../../mcp/server.js";
import { getGlobalOptions, requireProjectRoot } from "./helpers.js";

const SEPARATOR_WIDTH = 48;

function printSetupInstructions(): void {
  console.log("htap MCP server");
  console.log("");
  console.log("Add htap to your AI tool to give it access to captured HTTP traffic.");
  console.log("");

  const clients: { name: string; lines: string[] }[] = [
    {
      name: "Claude Code",
      lines: ["  claude mcp add htap -- htap mcp"],
    },
    {
      name: "Cursor",
      lines: [
        "  Add to .cursor/mcp.json:",
        "",
        "  {",
        '    "mcpServers": {',
        '      "htap": {',
        '        "command": "htap",',
        '        "args": ["mcp"]',
        "      }",
        "    }",
        "  }",
      ],
    },
    {
      name: "Codex",
      lines: ["  codex mcp add htap -- htap mcp"],
    },
    {
      name: "Other (Windsurf, etc.)",
      lines: [
        "  Add to your MCP client config:",
        "",
        "  {",
        '    "mcpServers": {',
        '      "htap": {',
        '        "command": "htap",',
        '        "args": ["mcp"]',
        "      }",
        "    }",
        "  }",
      ],
    },
  ];

  for (const client of clients) {
    const label = ` ${client.name} `;
    const padding = "\u2500".repeat(Math.max(0, SEPARATOR_WIDTH - label.length - 2));
    console.log(`\u2500\u2500${label}${padding}`);
    console.log("");
    for (const line of client.lines) {
      console.log(line);
    }
    console.log("");
  }

  console.log('Note: The proxy must be running (eval "$(htap on)") for the MCP server to connect.');
}

export const mcpCommand = new Command("mcp")
  .description("Start the htap MCP server (stdio transport for AI tool integration)")
  .action(async (_, command: Command) => {
    // If stdout is a TTY, user ran directly — show setup instructions instead
    if (process.stdout.isTTY) {
      printSetupInstructions();
      return;
    }

    const globalOpts = getGlobalOptions(command);
    const projectRoot = requireProjectRoot(globalOpts.dir);

    const mcp = createHtapMcpServer({ projectRoot });

    let closing = false;
    const shutdown = async () => {
      if (closing) return;
      closing = true;
      await mcp.close();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    await mcp.start();

    // Log to stderr (stdout is reserved for MCP JSON-RPC protocol)
    process.stderr.write(`htap MCP server running (project: ${projectRoot})\n`);
  });
