import { Command } from "commander";
import { createHttapMcpServer } from "../../mcp/server.js";
import { getGlobalOptions, requireProjectRoot } from "./helpers.js";

const SEPARATOR_WIDTH = 48;

function printSetupInstructions(): void {
  console.log("httap MCP server");
  console.log("");
  console.log("Add httap to your AI tool to give it access to captured HTTP traffic.");
  console.log("");

  const clients: { name: string; lines: string[] }[] = [
    {
      name: "Claude Code",
      lines: ["  claude mcp add httap -- httap mcp"],
    },
    {
      name: "Cursor",
      lines: [
        "  Add to .cursor/mcp.json:",
        "",
        "  {",
        '    "mcpServers": {',
        '      "httap": {',
        '        "command": "httap",',
        '        "args": ["mcp"]',
        "      }",
        "    }",
        "  }",
      ],
    },
    {
      name: "Codex",
      lines: ["  codex mcp add httap -- httap mcp"],
    },
    {
      name: "Other (Windsurf, etc.)",
      lines: [
        "  Add to your MCP client config:",
        "",
        "  {",
        '    "mcpServers": {',
        '      "httap": {',
        '        "command": "httap",',
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

  console.log(
    'Note: The proxy must be running (eval "$(httap on)") for the MCP server to connect.'
  );
}

export const mcpCommand = new Command("mcp")
  .description("Start the httap MCP server (stdio transport for AI tool integration)")
  .action(async (_, command: Command) => {
    // If stdout is a TTY, user ran directly — show setup instructions instead
    if (process.stdout.isTTY) {
      printSetupInstructions();
      return;
    }

    const globalOpts = getGlobalOptions(command);
    const projectRoot = requireProjectRoot(globalOpts.dir);

    const mcp = createHttapMcpServer({ projectRoot });

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
    process.stderr.write(`httap MCP server running (project: ${projectRoot})\n`);
  });
