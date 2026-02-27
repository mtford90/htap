import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const HTTAP_DIR = ".httap";
const HOME_DIR_PREFIX = "~";

/**
 * Module-level override for the httap data directory.
 * When set, getHttapDir returns this path directly instead of
 * appending .httap to the project root.
 */
let _configOverride: string | undefined;

export function setConfigOverride(dir: string | undefined): void {
  _configOverride = dir;
}

export function getConfigOverride(): string | undefined {
  return _configOverride;
}

/**
 * Resolve an override path, expanding ~ to the user's home directory
 * and converting relative paths to absolute.
 */
export function resolveOverridePath(override: string): string {
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
 * Find the project root by looking for .httap directory or .git directory.
 * Walks up the directory tree from the current working directory.
 * Returns undefined if no project root is found.
 *
 * When override is provided, returns the resolved override path only if
 * it contains an .httap or .git directory; otherwise returns undefined.
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
      fs.existsSync(path.join(resolved, HTTAP_DIR)) ||
      fs.existsSync(path.join(resolved, ".git"))
    ) {
      return resolved;
    }
    return undefined;
  }

  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    // Check for .httap directory first
    if (fs.existsSync(path.join(currentDir, HTTAP_DIR))) {
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
 * Determine the project root, creating .httap if needed.
 * Delegates to findProjectRoot for consistent traversal, then falls back
 * to the user's home directory (global instance) when no root is found.
 *
 * When override is provided, returns the resolved override path directly
 * (the caller is responsible for creating .httap as needed).
 */
export function findOrCreateProjectRoot(
  startDir: string = process.cwd(),
  override?: string
): string {
  if (override !== undefined) {
    return resolveOverridePath(override);
  }

  return findProjectRoot(startDir) ?? os.homedir();
}

/**
 * Get the .httap directory path for a project root.
 * Returns the config override when set (ignoring projectRoot).
 */
export function getHttapDir(projectRoot: string): string {
  return _configOverride ?? path.join(projectRoot, HTTAP_DIR);
}

/**
 * Ensure the .httap directory exists, creating it if necessary.
 * Returns the path to the .httap directory.
 */
export function ensureHttapDir(projectRoot: string): string {
  const httapDir = getHttapDir(projectRoot);

  if (!fs.existsSync(httapDir)) {
    fs.mkdirSync(httapDir, { recursive: true });
  }

  return httapDir;
}

/**
 * Get paths to various files within the .httap directory.
 */
export function getHttapPaths(projectRoot: string) {
  const httapDir = getHttapDir(projectRoot);

  return {
    httapDir,
    proxyPortFile: path.join(httapDir, "proxy.port"),
    preferredPortFile: path.join(httapDir, "preferred.port"),
    controlSocketFile: path.join(httapDir, "control.sock"),
    databaseFile: path.join(httapDir, "requests.db"),
    caKeyFile: path.join(httapDir, "ca-key.pem"),
    caCertFile: path.join(httapDir, "ca.pem"),
    pidFile: path.join(httapDir, "daemon.pid"),
    logFile: path.join(httapDir, "httap.log"),
    configFile: path.join(httapDir, "config.json"),
    interceptorsDir: path.join(httapDir, "interceptors"),
    browserProfilesDir: path.join(httapDir, "browser-profiles"),
    proxyPreloadFile: path.join(httapDir, "proxy-preload.cjs"),
    pythonOverrideDir: path.join(httapDir, "overrides", "python"),
    rubyOverrideFile: path.join(httapDir, "overrides", "ruby", "httap_intercept.rb"),
    phpOverrideDir: path.join(httapDir, "overrides", "php"),
  };
}

/**
 * Read the proxy port from the .httap directory.
 * Returns undefined if the file doesn't exist.
 */
export function readProxyPort(projectRoot: string): number | undefined {
  const { proxyPortFile } = getHttapPaths(projectRoot);

  if (!fs.existsSync(proxyPortFile)) {
    return undefined;
  }

  const content = fs.readFileSync(proxyPortFile, "utf-8").trim();
  const port = parseInt(content, 10);

  return isNaN(port) ? undefined : port;
}

/**
 * Write the proxy port to the .httap directory.
 */
export function writeProxyPort(projectRoot: string, port: number): void {
  const { proxyPortFile } = getHttapPaths(projectRoot);
  fs.writeFileSync(proxyPortFile, port.toString(), "utf-8");
}

/**
 * Read the daemon PID from the .httap directory.
 * Returns undefined if the file doesn't exist.
 */
export function readDaemonPid(projectRoot: string): number | undefined {
  const { pidFile } = getHttapPaths(projectRoot);

  if (!fs.existsSync(pidFile)) {
    return undefined;
  }

  const content = fs.readFileSync(pidFile, "utf-8").trim();
  const pid = parseInt(content, 10);

  return isNaN(pid) ? undefined : pid;
}

/**
 * Write the daemon PID to the .httap directory.
 */
export function writeDaemonPid(projectRoot: string, pid: number): void {
  const { pidFile } = getHttapPaths(projectRoot);
  fs.writeFileSync(pidFile, pid.toString(), "utf-8");
}

/**
 * Remove the daemon PID file.
 */
export function removeDaemonPid(projectRoot: string): void {
  const { pidFile } = getHttapPaths(projectRoot);

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
