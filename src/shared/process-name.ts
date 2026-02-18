/**
 * Resolve a PID to its process name using the system `ps` command.
 * Works on both macOS and Linux.
 */

import { execFileSync } from "node:child_process";
import * as path from "node:path";

const PROCESS_NAME_TIMEOUT_MS = 1000;

/**
 * Resolve a PID to its process basename (e.g. "node", "python3", "zsh").
 * Returns undefined if the process doesn't exist or the lookup fails.
 */
export function resolveProcessName(pid: number): string | undefined {
  try {
    const output = execFileSync("ps", ["-p", String(pid), "-o", "comm="], {
      timeout: PROCESS_NAME_TIMEOUT_MS,
      encoding: "utf-8",
    });
    const name = output.trim();
    if (!name) return undefined;
    return path.basename(name);
  } catch {
    return undefined;
  }
}
