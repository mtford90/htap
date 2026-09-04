import { defineConfig } from "vitest/config";

/** OpenTUI's renderer loads its native library through node:ffi, which Node 26.4 gates behind a flag. */
const TUI_EXEC_ARGV = ["--experimental-ffi", "--disable-warning=ExperimentalWarning"];

/**
 * The Ink tree's component tests synchronise with fixed sleeps, which miss under
 * macOS runner load; they fail on master too. They still run on Linux, and they
 * go away with the Ink tree itself after the HTTAP_TUI=ink escape hatch expires.
 */
const INK_TESTS_FLAKY_ON_DARWIN = [
  "src/cli/tui/App.test.tsx",
  "src/cli/tui/components/FilterBar.test.tsx",
];

const quarantined = process.platform === "darwin" ? INK_TESTS_FLAKY_ON_DARWIN : [];

const shared = {
  globals: true,
  environment: "node" as const,
  hookTimeout: 30_000,
  // Integration tests spin up real proxy servers (mockttp) and sockets;
  // running test files in parallel causes resource contention and cleanup hangs.
  fileParallelism: false,
};

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts"],
    },
    projects: [
      {
        test: {
          ...shared,
          name: "core",
          include: [
            "src/**/*.test.ts",
            "src/**/*.test.tsx",
            "tests/**/*.test.ts",
            "tests/**/*.test.tsx",
          ],
          exclude: ["**/node_modules/**", "**/dist/**", "src/tui/**/*.test.tsx", ...quarantined],
        },
      },
      {
        test: {
          ...shared,
          name: "tui",
          include: ["src/tui/**/*.test.tsx"],
          exclude: ["**/node_modules/**", "**/dist/**"],
          pool: "forks",
          execArgv: TUI_EXEC_ARGV,
        },
      },
    ],
  },
});
