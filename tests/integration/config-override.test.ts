import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as http from "node:http";
import { generateCACertificate } from "mockttp";
import { RequestRepository } from "../../src/daemon/storage.js";
import { createProxy } from "../../src/daemon/proxy.js";
import { createControlServer } from "../../src/daemon/control.js";
import { createReplayTracker } from "../../src/daemon/replay-tracker.js";
import { ControlClient } from "../../src/shared/control-client.js";
import {
  ensureProcsiDir,
  getProcsiPaths,
  setConfigOverride,
  getConfigOverride,
} from "../../src/shared/project.js";
import { createLogger } from "../../src/shared/logger.js";
import { loadConfig } from "../../src/shared/config.js";

describe("config override integration", () => {
  let tempDir: string;
  let configDir: string;
  let cleanup: (() => Promise<void>)[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "procsi-config-test-"));
    // The config dir is a standalone directory — no .procsi appended
    configDir = path.join(tempDir, "my-procsi-data");
    cleanup = [];
  });

  afterEach(async () => {
    // Always clear the override to avoid cross-test contamination
    setConfigOverride(undefined);

    const cleanupFns = [...cleanup].reverse();
    for (const fn of cleanupFns) {
      await fn();
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("daemon components use config dir when override is set", async () => {
    setConfigOverride(configDir);

    // ensureProcsiDir should create configDir directly
    ensureProcsiDir("/ignored-project-root");
    expect(fs.existsSync(configDir)).toBe(true);

    const paths = getProcsiPaths("/ignored-project-root");
    expect(paths.procsiDir).toBe(configDir);

    // Generate CA certificate inside config dir
    const ca = await generateCACertificate({
      subject: { commonName: "procsi Config Override Test CA" },
    });
    fs.writeFileSync(paths.caKeyFile, ca.key);
    fs.writeFileSync(paths.caCertFile, ca.cert);

    expect(fs.existsSync(path.join(configDir, "ca-key.pem"))).toBe(true);
    expect(fs.existsSync(path.join(configDir, "ca.pem"))).toBe(true);

    // Create storage inside config dir
    const storage = new RequestRepository(paths.databaseFile);
    cleanup.push(async () => {
      storage.close();
    });

    expect(fs.existsSync(path.join(configDir, "requests.db"))).toBe(true);

    // Start proxy
    const session = storage.registerSession("test", process.pid);
    const replayTracker = createReplayTracker();
    cleanup.push(async () => {
      replayTracker.close();
    });

    const proxy = await createProxy({
      caKeyPath: paths.caKeyFile,
      caCertPath: paths.caCertFile,
      storage,
      sessionId: session.id,
      replayTracker,
    });
    cleanup.push(proxy.stop);

    // Start control server inside config dir
    const controlServer = createControlServer({
      socketPath: paths.controlSocketFile,
      storage,
      proxyPort: proxy.port,
      version: "1.0.0",
      replayTracker,
    });
    cleanup.push(controlServer.close);

    expect(fs.existsSync(path.join(configDir, "control.sock"))).toBe(true);

    // Verify proxy captures requests and stores them in config dir
    const testServer = http.createServer((req, res) => {
      res.writeHead(200);
      res.end("ok");
    });
    await new Promise<void>((resolve) => testServer.listen(0, "127.0.0.1", resolve));
    const testServerAddress = testServer.address() as { port: number };
    cleanup.push(() => {
      testServer.closeAllConnections();
      return new Promise((resolve) => testServer.close(() => resolve()));
    });

    await makeProxiedRequest(proxy.port, `http://127.0.0.1:${testServerAddress.port}/config-test`);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const requests = storage.listRequests();
    expect(requests.find((r) => r.path === "/config-test")).toBeDefined();

    // Verify the client can connect via the control socket in config dir
    const client = new ControlClient(paths.controlSocketFile);
    const isAlive = await client.ping();
    expect(isAlive).toBe(true);
    client.close();
  });

  it("config override takes precedence over project root", () => {
    const projectRoot = path.join(tempDir, "project");
    fs.mkdirSync(path.join(projectRoot, ".procsi"), { recursive: true });

    setConfigOverride(configDir);
    fs.mkdirSync(configDir, { recursive: true });

    const paths = getProcsiPaths(projectRoot);
    // Should use configDir, not projectRoot/.procsi
    expect(paths.procsiDir).toBe(configDir);
    expect(paths.databaseFile).toBe(path.join(configDir, "requests.db"));
  });

  it("logger writes to config dir when override is set", () => {
    setConfigOverride(configDir);
    fs.mkdirSync(configDir, { recursive: true });

    const logger = createLogger("daemon", "/ignored-project-root", "debug");
    logger.debug("test message");
    logger.close();

    const logFile = path.join(configDir, "procsi.log");
    expect(fs.existsSync(logFile)).toBe(true);
    const content = fs.readFileSync(logFile, "utf-8");
    expect(content).toContain("test message");
  });

  it("loadConfig reads from config dir when override is set", () => {
    setConfigOverride(configDir);
    fs.mkdirSync(configDir, { recursive: true });

    // Write a custom config to the override dir
    fs.writeFileSync(
      path.join(configDir, "config.json"),
      JSON.stringify({ maxStoredRequests: 42 }),
      "utf-8"
    );

    const config = loadConfig("/ignored-project-root");
    expect(config.maxStoredRequests).toBe(42);
  });

  it("getConfigOverride returns undefined when no override is set", () => {
    expect(getConfigOverride()).toBeUndefined();
  });
});

function makeProxiedRequest(
  proxyPort: number,
  url: string
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
        Connection: "close",
      },
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body }));
    });

    req.on("error", reject);
    req.end();
  });
}
