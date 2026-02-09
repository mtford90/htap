import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const HTPX_DIR = ".htpx";
const HOME_DIR_PREFIX = "~";

/**
 * Resolve an override path, expanding ~ to the user's home directory
 * and converting relative paths to absolute.
 */
function resolveOverridePath(override: string): string {
  if (override.startsWith(HOME_DIR_PREFIX + path.sep) || override === HOME_DIR_PREFIX) {
    return path.join(os.homedir(), override.slice(HOME_DIR_PREFIX.length));
  }
  // Also handle ~/foo on platforms where sep is /
  if (override.startsWith(HOME_DIR_PREFIX + "/")) {
    return path.join(os.homedir(), override.slice(2));
  }
  return path.resolve(override);
}

/**
 * Find the project root by looking for .htpx directory or .git directory.
 * Walks up the directory tree from the current working directory.
 * Returns undefined if no project root is found.
 *
 * When override is provided, returns the resolved override path only if
 * it contains an .htpx or .git directory; otherwise returns undefined.
 *
 * @param startDir - Directory to start searching from. Pass `undefined` to
 *   use `process.cwd()` (common when only providing an override).
 * @param override - If provided, resolves this path (with `~` expansion)
 *   and checks it directly instead of walking the tree.
 */
export function findProjectRoot(
  startDir: string = process.cwd(),
  override?: string
): string | undefined {
  if (override !== undefined) {
    const resolved = resolveOverridePath(override);
    if (
      fs.existsSync(path.join(resolved, HTPX_DIR)) ||
      fs.existsSync(path.join(resolved, ".git"))
    ) {
      return resolved;
    }
    return undefined;
  }

  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    // Check for .htpx directory first
    if (fs.existsSync(path.join(currentDir, HTPX_DIR))) {
      return currentDir;
    }

    // Check for .git directory as fallback
    if (fs.existsSync(path.join(currentDir, ".git"))) {
      return currentDir;
    }

    currentDir = path.dirname(currentDir);
  }

  return undefined;
}

/**
 * Determine the project root, creating .htpx if needed.
 * - If .htpx exists anywhere in the tree, use that directory
 * - If .git exists, use the git root
 * - Otherwise, fall back to the user's home directory (global instance)
 *
 * When override is provided, returns the resolved override path directly
 * (the caller is responsible for creating .htpx as needed).
 */
export function findOrCreateProjectRoot(
  startDir: string = process.cwd(),
  override?: string
): string {
  if (override !== undefined) {
    return resolveOverridePath(override);
  }

  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;
  let gitRoot: string | undefined;

  while (currentDir !== root) {
    // Check for .htpx directory first - this takes priority
    if (fs.existsSync(path.join(currentDir, HTPX_DIR))) {
      return currentDir;
    }

    // Remember the git root if we find one
    if (!gitRoot && fs.existsSync(path.join(currentDir, ".git"))) {
      gitRoot = currentDir;
    }

    currentDir = path.dirname(currentDir);
  }

  // Fall back to home directory for a global htpx instance
  return gitRoot ?? os.homedir();
}

/**
 * Get the .htpx directory path for a project root.
 */
export function getHtpxDir(projectRoot: string): string {
  return path.join(projectRoot, HTPX_DIR);
}

/**
 * Ensure the .htpx directory exists, creating it if necessary.
 * Returns the path to the .htpx directory.
 */
export function ensureHtpxDir(projectRoot: string): string {
  const htpxDir = getHtpxDir(projectRoot);

  if (!fs.existsSync(htpxDir)) {
    fs.mkdirSync(htpxDir, { recursive: true });
  }

  return htpxDir;
}

/**
 * Get paths to various files within the .htpx directory.
 */
export function getHtpxPaths(projectRoot: string) {
  const htpxDir = getHtpxDir(projectRoot);

  return {
    htpxDir,
    proxyPortFile: path.join(htpxDir, "proxy.port"),
    controlSocketFile: path.join(htpxDir, "control.sock"),
    databaseFile: path.join(htpxDir, "requests.db"),
    caKeyFile: path.join(htpxDir, "ca-key.pem"),
    caCertFile: path.join(htpxDir, "ca.pem"),
    pidFile: path.join(htpxDir, "daemon.pid"),
    logFile: path.join(htpxDir, "htpx.log"),
    configFile: path.join(htpxDir, "config.json"),
    interceptorsDir: path.join(htpxDir, "interceptors"),
  };
}

/**
 * Read the proxy port from the .htpx directory.
 * Returns undefined if the file doesn't exist.
 */
export function readProxyPort(projectRoot: string): number | undefined {
  const { proxyPortFile } = getHtpxPaths(projectRoot);

  if (!fs.existsSync(proxyPortFile)) {
    return undefined;
  }

  const content = fs.readFileSync(proxyPortFile, "utf-8").trim();
  const port = parseInt(content, 10);

  return isNaN(port) ? undefined : port;
}

/**
 * Write the proxy port to the .htpx directory.
 */
export function writeProxyPort(projectRoot: string, port: number): void {
  const { proxyPortFile } = getHtpxPaths(projectRoot);
  fs.writeFileSync(proxyPortFile, port.toString(), "utf-8");
}

/**
 * Read the daemon PID from the .htpx directory.
 * Returns undefined if the file doesn't exist.
 */
export function readDaemonPid(projectRoot: string): number | undefined {
  const { pidFile } = getHtpxPaths(projectRoot);

  if (!fs.existsSync(pidFile)) {
    return undefined;
  }

  const content = fs.readFileSync(pidFile, "utf-8").trim();
  const pid = parseInt(content, 10);

  return isNaN(pid) ? undefined : pid;
}

/**
 * Write the daemon PID to the .htpx directory.
 */
export function writeDaemonPid(projectRoot: string, pid: number): void {
  const { pidFile } = getHtpxPaths(projectRoot);
  fs.writeFileSync(pidFile, pid.toString(), "utf-8");
}

/**
 * Remove the daemon PID file.
 */
export function removeDaemonPid(projectRoot: string): void {
  const { pidFile } = getHtpxPaths(projectRoot);

  if (fs.existsSync(pidFile)) {
    fs.unlinkSync(pidFile);
  }
}

/**
 * Check if a process with the given PID is running.
 */
export function isProcessRunning(pid: number): boolean {
  try {
    // Sending signal 0 checks if the process exists without actually sending a signal
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
