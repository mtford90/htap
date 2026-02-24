import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const HTAP_DIR = ".htap";
const HOME_DIR_PREFIX = "~";

/**
 * Module-level override for the htap data directory.
 * When set, getHtapDir returns this path directly instead of
 * appending .htap to the project root.
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
 * Find the project root by looking for .htap directory or .git directory.
 * Walks up the directory tree from the current working directory.
 * Returns undefined if no project root is found.
 *
 * When override is provided, returns the resolved override path only if
 * it contains an .htap or .git directory; otherwise returns undefined.
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
      fs.existsSync(path.join(resolved, HTAP_DIR)) ||
      fs.existsSync(path.join(resolved, ".git"))
    ) {
      return resolved;
    }
    return undefined;
  }

  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    // Check for .htap directory first
    if (fs.existsSync(path.join(currentDir, HTAP_DIR))) {
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
 * Determine the project root, creating .htap if needed.
 * Delegates to findProjectRoot for consistent traversal, then falls back
 * to the user's home directory (global instance) when no root is found.
 *
 * When override is provided, returns the resolved override path directly
 * (the caller is responsible for creating .htap as needed).
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
 * Get the .htap directory path for a project root.
 * Returns the config override when set (ignoring projectRoot).
 */
export function getHtapDir(projectRoot: string): string {
  return _configOverride ?? path.join(projectRoot, HTAP_DIR);
}

/**
 * Ensure the .htap directory exists, creating it if necessary.
 * Returns the path to the .htap directory.
 */
export function ensureHtapDir(projectRoot: string): string {
  const htapDir = getHtapDir(projectRoot);

  if (!fs.existsSync(htapDir)) {
    fs.mkdirSync(htapDir, { recursive: true });
  }

  return htapDir;
}

/**
 * Get paths to various files within the .htap directory.
 */
export function getHtapPaths(projectRoot: string) {
  const htapDir = getHtapDir(projectRoot);

  return {
    htapDir,
    proxyPortFile: path.join(htapDir, "proxy.port"),
    preferredPortFile: path.join(htapDir, "preferred.port"),
    controlSocketFile: path.join(htapDir, "control.sock"),
    databaseFile: path.join(htapDir, "requests.db"),
    caKeyFile: path.join(htapDir, "ca-key.pem"),
    caCertFile: path.join(htapDir, "ca.pem"),
    pidFile: path.join(htapDir, "daemon.pid"),
    logFile: path.join(htapDir, "htap.log"),
    configFile: path.join(htapDir, "config.json"),
    interceptorsDir: path.join(htapDir, "interceptors"),
    browserProfilesDir: path.join(htapDir, "browser-profiles"),
    proxyPreloadFile: path.join(htapDir, "proxy-preload.cjs"),
    pythonOverrideDir: path.join(htapDir, "overrides", "python"),
    rubyOverrideFile: path.join(htapDir, "overrides", "ruby", "htap_intercept.rb"),
    phpOverrideDir: path.join(htapDir, "overrides", "php"),
  };
}

/**
 * Read the proxy port from the .htap directory.
 * Returns undefined if the file doesn't exist.
 */
export function readProxyPort(projectRoot: string): number | undefined {
  const { proxyPortFile } = getHtapPaths(projectRoot);

  if (!fs.existsSync(proxyPortFile)) {
    return undefined;
  }

  const content = fs.readFileSync(proxyPortFile, "utf-8").trim();
  const port = parseInt(content, 10);

  return isNaN(port) ? undefined : port;
}

/**
 * Write the proxy port to the .htap directory.
 */
export function writeProxyPort(projectRoot: string, port: number): void {
  const { proxyPortFile } = getHtapPaths(projectRoot);
  fs.writeFileSync(proxyPortFile, port.toString(), "utf-8");
}

/**
 * Read the daemon PID from the .htap directory.
 * Returns undefined if the file doesn't exist.
 */
export function readDaemonPid(projectRoot: string): number | undefined {
  const { pidFile } = getHtapPaths(projectRoot);

  if (!fs.existsSync(pidFile)) {
    return undefined;
  }

  const content = fs.readFileSync(pidFile, "utf-8").trim();
  const pid = parseInt(content, 10);

  return isNaN(pid) ? undefined : pid;
}

/**
 * Write the daemon PID to the .htap directory.
 */
export function writeDaemonPid(projectRoot: string, pid: number): void {
  const { pidFile } = getHtapPaths(projectRoot);
  fs.writeFileSync(pidFile, pid.toString(), "utf-8");
}

/**
 * Remove the daemon PID file.
 */
export function removeDaemonPid(projectRoot: string): void {
  const { pidFile } = getHtapPaths(projectRoot);

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
