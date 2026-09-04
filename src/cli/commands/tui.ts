import { Command } from "commander";
import { findProjectRoot, setConfigOverride, resolveOverridePath } from "../../shared/project.js";
import { getGlobalOptions } from "./helpers.js";

/**
 * OpenTUI's renderer loads its native library through node:ffi, which Node gates
 * behind this flag. The installed `httap` binary (bin/httap) checks the version
 * and execs Node with the flag, so this only fires for the CLI reached without
 * going through that binary (e.g. `node dist/cli/index.js` directly). Drop this
 * whole check once the floor is a release that enables node:ffi by default.
 */
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
  /** Passed on so the launched TUI resolves the same .httap directory. */
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
  // React's development reconciler leaks memory, so default OpenTUI to
  // production too. It has to be set before the import below pulls in
  // @opentui/react, which is when react-reconciler picks its build.
  process.env["NODE_ENV"] = process.env["NODE_ENV"] ?? "production";

  if (ffiAlreadyEnabled()) {
    const { runTui } = await import("../../tui/main.js");
    await runTui(options);
    return;
  }

  if (!supportsFfiFlag(process.versions.node)) {
    console.error(
      `httap tui needs Node ${MIN_FFI_NODE.major}.${MIN_FFI_NODE.minor}+ (you have ${process.version}).`
    );
    process.exit(1);
  }

  console.error(
    "httap tui needs Node's --experimental-ffi flag. Run it via the installed `httap` " +
      "command rather than `node dist/cli/index.js`, or set NODE_OPTIONS=--experimental-ffi yourself."
  );
  process.exit(1);
};

export const tuiCommand = new Command("tui")
  .description("Browse captured HTTP traffic")
  .option("--ci", "CI mode: render once and exit after the first synced frame (for testing)")
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
