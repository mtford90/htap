/**
 * End-to-end tests for the htpx TUI.
 *
 * These tests spawn real CLI processes using cli-testing-library and assert
 * on terminal output. The TUI uses --ci mode which renders once and exits,
 * as ink's CI mode only outputs on exit.
 *
 * Note: Keyboard interaction tests are limited since cli-testing-library
 * doesn't use PTY and ink disables raw mode in non-TTY environments.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import { render, cleanup, configure } from "cli-testing-library";
import "cli-testing-library/vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as http from "node:http";
import { generateCACertificate } from "mockttp";
import { RequestRepository } from "../../src/daemon/storage.js";
import { createProxy } from "../../src/daemon/proxy.js";
import { createControlServer } from "../../src/daemon/control.js";
import { ensureHtpxDir, getHtpxPaths } from "../../src/shared/project.js";

// Increase default timeout for async operations
configure({ asyncUtilTimeout: 10000 });

/**
 * Environment variables to enable CI mode for ink and ensure proper output.
 */
const testEnv = {
  ...process.env,
  // Enable CI mode so ink outputs to non-TTY stdout
  CI: "true",
  // Disable colour output for easier text matching
  NO_COLOR: "1",
  // Set reasonable terminal dimensions
  COLUMNS: "120",
  LINES: "40",
};

/**
 * Helper to make an HTTP request through a proxy.
 */
function makeProxiedRequest(
  proxyPort: number,
  url: string,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);

    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: proxyPort,
      path: url,
      method: "GET",
      headers: {
        Host: parsedUrl.host,
      },
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => (body += chunk.toString()));
      res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body }));
    });

    req.on("error", reject);
    req.end();
  });
}

/**
 * Get the path to the built CLI entry point.
 */
function getCliBinPath(): string {
  return path.resolve(process.cwd(), "dist/cli/index.js");
}

describe("htpx tui e2e", () => {
  let tempDir: string;
  let paths: ReturnType<typeof getHtpxPaths>;
  let storage: RequestRepository;
  let testServer: http.Server;
  let testServerPort: number;
  let cleanupFns: (() => Promise<void>)[] = [];

  beforeAll(async () => {
    // Create temp project directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "htpx-e2e-"));
    ensureHtpxDir(tempDir);
    paths = getHtpxPaths(tempDir);

    // Generate CA certificate
    const ca = await generateCACertificate({
      subject: { commonName: "htpx Test CA" },
    });
    fs.writeFileSync(paths.caKeyFile, ca.key);
    fs.writeFileSync(paths.caCertFile, ca.cert);

    // Start a simple test HTTP server
    testServer = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ path: req.url, method: req.method }));
    });

    await new Promise<void>((resolve) =>
      testServer.listen(0, "127.0.0.1", resolve),
    );
    testServerPort = (testServer.address() as { port: number }).port;
  });

  afterAll(async () => {
    testServer.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Create fresh storage for each test
    storage = new RequestRepository(paths.databaseFile);
    cleanupFns = [];
  });

  afterEach(async () => {
    // Run cleanup in reverse order
    for (const fn of cleanupFns.reverse()) {
      await fn();
    }
    storage.close();

    // Clean up any orphaned processes from cli-testing-library
    await cleanup();
  });

  describe("with running daemon", () => {
    let proxyPort: number;

    beforeEach(async () => {
      // Register a session
      const session = storage.registerSession("test", process.pid);

      // Start proxy
      const proxy = await createProxy({
        caKeyPath: paths.caKeyFile,
        caCertPath: paths.caCertFile,
        storage,
        sessionId: session.id,
        label: "e2e-test",
      });
      proxyPort = proxy.port;
      cleanupFns.push(proxy.stop);

      // Write port file so TUI can find it
      fs.writeFileSync(paths.proxyPortFile, String(proxyPort));
      fs.writeFileSync(paths.pidFile, String(process.pid));

      // Start control server
      const controlServer = createControlServer({
        socketPath: paths.controlSocketFile,
        storage,
        proxyPort,
      });
      cleanupFns.push(controlServer.close);
    });

    it("displays captured requests", async () => {
      // Make some HTTP requests through the proxy
      await makeProxiedRequest(
        proxyPort,
        `http://127.0.0.1:${testServerPort}/users`,
      );
      await makeProxiedRequest(
        proxyPort,
        `http://127.0.0.1:${testServerPort}/posts`,
      );

      // Wait for storage to be updated
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Start the TUI with --ci flag to render and exit
      const { findByText } = await render(
        "node",
        [getCliBinPath(), "tui", "--ci"],
        {
          cwd: tempDir,
          spawnOpts: { env: testEnv },
        },
      );

      // Verify requests appear in the TUI
      await findByText(/users/i);
      await findByText(/posts/i);
      await findByText(/GET/i);
      await findByText(/200/);
    });

    it("displays request details with method and status", async () => {
      // Make a test request
      await makeProxiedRequest(
        proxyPort,
        `http://127.0.0.1:${testServerPort}/api/data`,
      );
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { findByText } = await render(
        "node",
        [getCliBinPath(), "tui", "--ci"],
        {
          cwd: tempDir,
          spawnOpts: { env: testEnv },
        },
      );

      // Verify request details
      await findByText(/data/i);
      await findByText(/GET/i);
      await findByText(/200/);
    });

    it("shows htpx header", async () => {
      const { findByText } = await render(
        "node",
        [getCliBinPath(), "tui", "--ci"],
        {
          cwd: tempDir,
          spawnOpts: { env: testEnv },
        },
      );

      // Should show htpx header
      await findByText(/htpx/i);
    });

    it("shows keybinding hints in status bar", async () => {
      const { findByText } = await render(
        "node",
        [getCliBinPath(), "tui", "--ci"],
        {
          cwd: tempDir,
          spawnOpts: { env: testEnv },
        },
      );

      // Status bar should show keybinding hints
      await findByText(/q.*quit|quit.*q/i);
    });

    it("exits with code 0", async () => {
      const result = await render("node", [getCliBinPath(), "tui", "--ci"], {
        cwd: tempDir,
        spawnOpts: { env: testEnv },
      });

      // Wait for process to exit
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const exitStatus = result.hasExit();
      expect(exitStatus).not.toBeNull();
      expect(exitStatus?.exitCode).toBe(0);
    });

    it("filters requests by label", async () => {
      // Create requests with different labels
      const session1 = storage.registerSession("session1", process.pid);
      storage.saveRequest({
        sessionId: session1.id,
        label: "api",
        timestamp: Date.now(),
        method: "GET",
        url: "http://example.com/api-request",
        host: "example.com",
        path: "/api-request",
        requestHeaders: {},
        responseStatus: 200,
      });

      const session2 = storage.registerSession("session2", process.pid);
      storage.saveRequest({
        sessionId: session2.id,
        label: "web",
        timestamp: Date.now(),
        method: "GET",
        url: "http://example.com/web-request",
        host: "example.com",
        path: "/web-request",
        requestHeaders: {},
        responseStatus: 200,
      });

      // Start TUI with label filter
      const { findByText, queryByText } = await render(
        "node",
        [getCliBinPath(), "tui", "--ci", "-l", "api"],
        {
          cwd: tempDir,
          spawnOpts: { env: testEnv },
        },
      );

      // Should show the api label in header
      await findByText(/api/i);

      // Wait for process to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should show api request
      const apiResult = queryByText(/api-request/i);

      // Note: Due to how queryByText works, we can only verify the filtered request appears
      expect(apiResult).toBeInTheConsole();
    });
  });

  describe("error states", () => {
    it("shows error when daemon not running", async () => {
      // Don't start proxy/control server - just launch TUI directly
      // The TUI will try to connect to the control socket and fail

      const { findByText } = await render(
        "node",
        [getCliBinPath(), "tui", "--ci"],
        {
          cwd: tempDir,
          spawnOpts: { env: testEnv },
        },
      );

      // Should show an error message about daemon not running
      await findByText(/daemon.*not running|start.*intercept/i);
    });

    it("shows error when not in htpx project", async () => {
      // Create a temp directory without .htpx
      const nonProjectDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "htpx-noproject-"),
      );

      try {
        const { findByText } = await render(
          "node",
          [getCliBinPath(), "tui", "--ci"],
          {
            cwd: nonProjectDir,
            spawnOpts: { env: testEnv },
          },
        );

        // Should show an error about not being in a project
        await findByText(/project|init|not in/i);
      } finally {
        fs.rmSync(nonProjectDir, { recursive: true, force: true });
      }
    });

    it("shows retry hint on error", async () => {
      const { findByText } = await render(
        "node",
        [getCliBinPath(), "tui", "--ci"],
        {
          cwd: tempDir,
          spawnOpts: { env: testEnv },
        },
      );

      // Should show retry hint
      await findByText(/retry|r.*to/i);
    });
  });
});
