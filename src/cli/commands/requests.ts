/**
 * `procsi requests` — list, search, query, count, and clear captured requests.
 */

import { Command } from "commander";
import { ControlClient } from "../../shared/control-client.js";
import { getProcsiPaths } from "../../shared/project.js";
import { isDaemonRunning } from "../../shared/daemon.js";
import type { RequestFilter } from "../../shared/types.js";
import { requireProjectRoot, getErrorMessage, getGlobalOptions } from "./helpers.js";
import { formatRequestTable } from "../formatters/table.js";
import { formatHint, shouldShowHints } from "../formatters/hints.js";
import { parseTime } from "../utils/parse-time.js";

const DEFAULT_LIMIT = 50;

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const STATUS_RANGES = ["1xx", "2xx", "3xx", "4xx", "5xx"];

interface RequestsFlags {
  method?: string;
  status?: string;
  host?: string;
  path?: string;
  search?: string;
  since?: string;
  before?: string;
  header?: string;
  headerTarget?: string;
  interceptedBy?: string;
  limit?: string;
  offset?: string;
  json?: boolean;
}

/**
 * Build a RequestFilter from CLI flags.
 */
function buildFilter(opts: RequestsFlags): RequestFilter {
  const filter: RequestFilter = {};

  if (opts.method) {
    filter.methods = opts.method.split(",").map((m) => m.trim().toUpperCase());
  }

  if (opts.status) {
    filter.statusRange = opts.status;
  }

  if (opts.host) {
    filter.host = opts.host;
  }

  if (opts.path) {
    filter.pathPrefix = opts.path;
  }

  if (opts.search) {
    filter.search = opts.search;
  }

  if (opts.since) {
    filter.since = parseTime(opts.since);
  }

  if (opts.before) {
    filter.before = parseTime(opts.before);
  }

  if (opts.header) {
    const colonIdx = opts.header.indexOf(":");
    if (colonIdx > 0) {
      filter.headerName = opts.header.slice(0, colonIdx);
      filter.headerValue = opts.header.slice(colonIdx + 1);
    } else {
      filter.headerName = opts.header;
    }
  }

  if (opts.headerTarget) {
    const target = opts.headerTarget as "request" | "response" | "both";
    filter.headerTarget = target;
  }

  if (opts.interceptedBy) {
    filter.interceptedBy = opts.interceptedBy;
  }

  return filter;
}

/**
 * Shared logic to connect to the daemon and return a client.
 */
async function connectToDaemon(command: Command): Promise<{
  client: ControlClient;
  projectRoot: string;
}> {
  const globalOpts = getGlobalOptions(command);
  const projectRoot = requireProjectRoot(globalOpts.dir);
  const paths = getProcsiPaths(projectRoot);

  const running = await isDaemonRunning(projectRoot);
  if (!running) {
    console.error("Daemon is not running. Start it with: procsi on");
    process.exit(1);
  }

  const client = new ControlClient(paths.controlSocketFile);
  return { client, projectRoot };
}

/**
 * Add common filter flags to a command.
 */
function addFilterFlags(cmd: Command): Command {
  return cmd
    .option(
      "--method <methods>",
      `filter by HTTP method (comma-separated: ${HTTP_METHODS.join(",")})`
    )
    .option(
      "--status <range>",
      `filter by status range (${STATUS_RANGES.join(", ")}, or exact e.g. 401)`
    )
    .option("--host <host>", "filter by hostname")
    .option("--path <prefix>", "filter by path prefix")
    .option("--search <text>", "substring match on URL")
    .option("--since <time>", "filter from time (e.g. 5m, 2h, 10am, yesterday, 2024-01-01)")
    .option("--before <time>", "filter before time (same formats as --since)")
    .option("--header <spec>", "filter by header name or name:value")
    .option("--header-target <target>", "which headers to search", "both")
    .option("--intercepted-by <name>", "filter by interceptor name");
}

// --- Subcommands ---

const searchSubcommand = new Command("search")
  .description("Full-text search through request/response bodies")
  .argument("<query>", "search string")
  .option("--limit <n>", "max results", String(DEFAULT_LIMIT))
  .option("--offset <n>", "skip results", "0")
  .option("--json", "JSON output");

addFilterFlags(searchSubcommand);

searchSubcommand.action(
  async (
    query: string,
    opts: RequestsFlags & { limit?: string; offset?: string },
    command: Command
  ) => {
    const { client } = await connectToDaemon(command);
    try {
      const filter = buildFilter(opts);
      const limit = parseInt(opts.limit ?? String(DEFAULT_LIMIT), 10);
      const offset = parseInt(opts.offset ?? "0", 10);

      const results = await client.searchBodies({ query, limit, offset, filter });

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      if (results.length === 0) {
        console.log(`  No requests found matching "${query}"`);
        return;
      }

      console.log(formatRequestTable(results, results.length));

      if (shouldShowHints()) {
        console.log(formatHint(["procsi request <id> for detail", "--json for JSON output"]));
      }
    } catch (err) {
      console.error(`Error searching requests: ${getErrorMessage(err)}`);
      process.exit(1);
    } finally {
      client.close();
    }
  }
);

const querySubcommand = new Command("query")
  .description("Query JSON bodies using JSONPath")
  .argument("<jsonpath>", "JSONPath expression (e.g. $.data.id)")
  .option("--value <v>", "filter by extracted value")
  .option("--target <target>", "request, response, or both", "both")
  .option("--limit <n>", "max results", String(DEFAULT_LIMIT))
  .option("--offset <n>", "skip results", "0")
  .option("--json", "JSON output");

addFilterFlags(querySubcommand);

querySubcommand.action(
  async (
    jsonPath: string,
    opts: RequestsFlags & { value?: string; target?: string; limit?: string; offset?: string },
    command: Command
  ) => {
    const { client } = await connectToDaemon(command);
    try {
      const filter = buildFilter(opts);
      const limit = parseInt(opts.limit ?? String(DEFAULT_LIMIT), 10);
      const offset = parseInt(opts.offset ?? "0", 10);
      const target = (opts.target ?? "both") as "request" | "response" | "both";

      const results = await client.queryJsonBodies({
        jsonPath,
        value: opts.value,
        target,
        limit,
        offset,
        filter,
      });

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      if (results.length === 0) {
        console.log(`  No results for JSONPath "${jsonPath}"`);
        return;
      }

      // Show table with extracted values
      for (const result of results) {
        const shortId = result.id.slice(0, 7);
        const value = JSON.stringify(result.extractedValue);
        console.log(`  ${shortId}  ${result.method} ${result.path}  →  ${value}`);
      }
    } catch (err) {
      console.error(`Error querying requests: ${getErrorMessage(err)}`);
      process.exit(1);
    } finally {
      client.close();
    }
  }
);

const countSubcommand = new Command("count")
  .description("Count requests matching filters")
  .option("--json", "JSON output");

addFilterFlags(countSubcommand);

countSubcommand.action(async (opts: RequestsFlags, command: Command) => {
  const { client } = await connectToDaemon(command);
  try {
    const filter = buildFilter(opts);
    const count = await client.countRequests({ filter });

    if (opts.json) {
      console.log(JSON.stringify({ count }));
      return;
    }

    console.log(`  ${count} request${count === 1 ? "" : "s"}`);
  } catch (err) {
    console.error(`Error counting requests: ${getErrorMessage(err)}`);
    process.exit(1);
  } finally {
    client.close();
  }
});

const clearSubcommand = new Command("clear")
  .description("Clear all captured requests")
  .option("--yes", "skip confirmation prompt")
  .action(async (opts: { yes?: boolean }, command: Command) => {
    const { client } = await connectToDaemon(command);
    try {
      if (!opts.yes && process.stdout.isTTY) {
        // Simple confirmation via stdin
        const readline = await import("node:readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        const answer = await new Promise<string>((resolve) => {
          rl.question("  Clear all captured requests? [y/N] ", resolve);
        });
        rl.close();
        if (answer.toLowerCase() !== "y") {
          console.log("  Cancelled");
          return;
        }
      }

      await client.clearRequests();
      console.log("  Requests cleared");
    } catch (err) {
      console.error(`Error clearing requests: ${getErrorMessage(err)}`);
      process.exit(1);
    } finally {
      client.close();
    }
  });

// --- Main `requests` command ---

export const requestsCommand = new Command("requests")
  .description("List and filter captured requests")
  .option("--limit <n>", "max results", String(DEFAULT_LIMIT))
  .option("--offset <n>", "skip results", "0")
  .option("--json", "JSON output")
  .addCommand(searchSubcommand)
  .addCommand(querySubcommand)
  .addCommand(countSubcommand)
  .addCommand(clearSubcommand);

addFilterFlags(requestsCommand);

requestsCommand.action(
  async (opts: RequestsFlags & { limit?: string; offset?: string }, command: Command) => {
    const { client } = await connectToDaemon(command);
    try {
      const filter = buildFilter(opts);
      const limit = parseInt(opts.limit ?? String(DEFAULT_LIMIT), 10);
      const offset = parseInt(opts.offset ?? "0", 10);

      // Fetch summaries and count in parallel
      const [summaries, total] = await Promise.all([
        client.listRequestsSummary({ limit, offset, filter }),
        client.countRequests({ filter }),
      ]);

      if (opts.json) {
        console.log(JSON.stringify({ requests: summaries, total, limit, offset }, null, 2));
        return;
      }

      if (summaries.length === 0) {
        console.log("  No requests captured");
        if (shouldShowHints()) {
          console.log(formatHint(["make HTTP requests while procsi is intercepting"]));
        }
        return;
      }

      console.log(formatRequestTable(summaries, total));

      if (shouldShowHints()) {
        console.log(
          formatHint([
            "procsi request <id>",
            "--method, --status, --host to filter",
            "--json for JSON",
          ])
        );
      }
    } catch (err) {
      console.error(`Error listing requests: ${getErrorMessage(err)}`);
      process.exit(1);
    } finally {
      client.close();
    }
  }
);
