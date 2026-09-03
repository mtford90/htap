/**
 * Process entry for the OpenTUI TUI.
 *
 * `httap tui` re-executes Node with the FFI flag and passes its resolved
 * options here as one JSON argument.
 */

import { startTui, type StartTuiOptions } from "./main.js";

const parseOptions = (raw: string | undefined): StartTuiOptions => {
  if (!raw) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (typeof parsed !== "object" || parsed === null) {
    return {};
  }

  const record = parsed as Record<string, unknown>;
  return {
    projectRoot: typeof record["projectRoot"] === "string" ? record["projectRoot"] : undefined,
    configOverride:
      typeof record["configOverride"] === "string" ? record["configOverride"] : undefined,
    ci: record["ci"] === true,
    verbose: typeof record["verbose"] === "number" ? record["verbose"] : undefined,
  };
};

// The running session deliberately survives a stray rejection, so a failure to
// start has to be reported here rather than by that listener.
try {
  await startTui(parseOptions(process.argv[2]));
} catch (error) {
  const cause = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`httap tui failed to start: ${cause}\n`);
  process.exit(1);
}
