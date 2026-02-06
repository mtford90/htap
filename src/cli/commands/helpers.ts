import { findProjectRoot } from "../../shared/project.js";

/**
 * Find the project root or exit with a friendly error message.
 */
export function requireProjectRoot(): string {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    console.error("Not in a project directory (no .htpx or .git found)");
    process.exit(1);
  }
  return projectRoot;
}

/**
 * Extract a human-readable message from an unknown error value.
 */
export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}
