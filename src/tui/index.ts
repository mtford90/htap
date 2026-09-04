/**
 * Process entry for the OpenTUI TUI.
 *
 * `httap tui` re-executes Node with the FFI flag and passes its resolved
 * options here as one JSON argument.
 */

import { runTui, type StartTuiOptions } from "./main.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

  if (!isRecord(parsed)) {
    return {};
  }

  return {
    projectRoot: typeof parsed["projectRoot"] === "string" ? parsed["projectRoot"] : undefined,
    configOverride:
      typeof parsed["configOverride"] === "string" ? parsed["configOverride"] : undefined,
    ci: parsed["ci"] === true,
    verbose: typeof parsed["verbose"] === "number" ? parsed["verbose"] : undefined,
  };
};

await runTui(parseOptions(process.argv[2]));
