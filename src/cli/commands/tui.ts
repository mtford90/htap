import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { findProjectRoot, setConfigOverride, resolveOverridePath } from "../../shared/project.js";
import { getGlobalOptions } from "./helpers.js";

/**
 * OpenTUI's renderer loads its native library through node:ffi, which Node gates
 * behind this flag. Node has since made the flag a no-op; drop this whole branch
 * once the floor is a release that enables node:ffi by default.
 */
const FFI_FLAGS = ["--experimental-ffi", "--disable-warning=ExperimentalWarning"];
const MIN_FFI_NODE = { major: 26, minor: 4 };

export const supportsFfiFlag = (version: string): boolean => {
  const [major = 0, minor = 0] = version.replace(/^v/, "").split(".").map(Number);
  return (
    major > MIN_FFI_NODE.major || (major === MIN_FFI_NODE.major && minor >= MIN_FFI_NODE.minor)
  );
};

/** True when this process was already started with FFI enabled. */
const ffiAlreadyEnabled = (): boolean =>
  process.execArgv.some((argument) => argument.startsWith("--experimental-ffi")) ||
  (process.env["NODE_OPTIONS"] ?? "").includes("--experimental-ffi");

export interface TuiLaunchOptions {
  projectRoot?: string;
  /** Passed on so the child process resolves the same .httap directory. */
  configOverride?: string;
  ci: boolean;
  verbose: number;
}

const runInkTui = async (options: TuiLaunchOptions): Promise<void> => {
  // React's development reconciler leaks memory, so default Ink to production.
  process.env["NODE_ENV"] = process.env["NODE_ENV"] ?? "production";
  const { startInkTui } = await import("../tui/start.js");
  await startInkTui(options);
};

const runOpenTui = async (options: TuiLaunchOptions): Promise<void> => {
  if (ffiAlreadyEnabled()) {
    const { startTui } = await import("../../tui/main.js");
    await startTui(options);
    return;
  }

  if (!supportsFfiFlag(process.versions.node)) {
    console.error(
      `httap tui needs Node ${MIN_FFI_NODE.major}.${MIN_FFI_NODE.minor}+ (you have ${process.version}).`
    );
    process.exit(1);
  }

  const entry = fileURLToPath(new URL("../../tui/index.js", import.meta.url));
  const result = spawnSync(process.execPath, [...FFI_FLAGS, entry, JSON.stringify(options)], {
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
};

export const tuiCommand = new Command("tui")
  .description("Browse captured HTTP traffic")
  .option("--ci", "CI mode: render once and exit after a short delay (for testing)")
  .action(async (options: { ci?: boolean }, command: Command) => {
    const globalOptions = getGlobalOptions(command);

    if (globalOptions.config) {
      setConfigOverride(resolveOverridePath(globalOptions.config));
    }

    const projectRoot = globalOptions.config
      ? resolveOverridePath(globalOptions.config)
      : findProjectRoot(undefined, globalOptions.dir);

    const launchOptions: TuiLaunchOptions = {
      projectRoot: projectRoot ?? undefined,
      configOverride: globalOptions.config ? resolveOverridePath(globalOptions.config) : undefined,
      ci: options.ci === true,
      verbose: globalOptions.verbose,
    };

    // Escape hatch for one minor version while the OpenTUI TUI settles.
    if (process.env["HTTAP_TUI"] === "ink") {
      await runInkTui(launchOptions);
      return;
    }

    await runOpenTui(launchOptions);
  });
