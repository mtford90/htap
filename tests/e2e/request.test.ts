/**
 * End-to-end tests for `httap request <id> <subcommand>`.
 *
 * These spawn the built CLI as a real process so commander's argument
 * parsing is exercised end to end, not just the ControlClient methods
 * the command handlers call.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { RequestRepository } from "../../src/daemon/storage.js";
import { createControlServer } from "../../src/daemon/control.js";
import { ensureHttapDir, getHttapPaths } from "../../src/shared/project.js";

const execFileAsync = promisify(execFile);

interface CliResult {
  stdout: string;
  stderr: string;
  code: number;
}

async function runCli(cwd: string, args: string[]): Promise<CliResult> {
  try {
    const { stdout, stderr } = await execFileAsync("node", [getCliBinPath(), ...args], {
      cwd,
      encoding: "utf-8",
    });
    return { stdout, stderr, code: 0 };
  } catch (err) {
    const failure = err as { stdout?: string; stderr?: string; code?: number };
    return { stdout: failure.stdout ?? "", stderr: failure.stderr ?? "", code: failure.code ?? 1 };
  }
}

function getCliBinPath(): string {
  return path.resolve(process.cwd(), "dist/cli/index.js");
}

describe("httap request <subcommand> <id> e2e", () => {
  let tempDir: string;
  let paths: ReturnType<typeof getHttapPaths>;
  let storage: RequestRepository;
  let closeControlServer: () => Promise<void>;
  let requestId: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "httap-request-e2e-"));
    ensureHttapDir(tempDir);
    paths = getHttapPaths(tempDir);

    storage = new RequestRepository(paths.databaseFile);
    const session = storage.registerSession("test", process.pid);
    requestId = storage.saveRequest({
      sessionId: session.id,
      timestamp: Date.now(),
      method: "GET",
      url: "https://api.example.com/users",
      host: "api.example.com",
      path: "/users",
      requestHeaders: {},
    });
    storage.updateRequestResponse(requestId, {
      status: 200,
      headers: { "content-type": "application/json" },
      body: Buffer.from(JSON.stringify({ ok: true })),
      durationMs: 12,
    });

    const controlServer = createControlServer({
      socketPath: paths.controlSocketFile,
      storage,
      proxyPort: 0,
      version: "1.0.0-test",
    });
    closeControlServer = controlServer.close;

    fs.writeFileSync(paths.pidFile, String(process.pid));
  });

  afterEach(async () => {
    await closeControlServer();
    storage.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("dumps the response body via `httap request body <id>`", async () => {
    const { stdout } = await execFileAsync(
      "node",
      [getCliBinPath(), "request", "body", requestId],
      {
        cwd: tempDir,
        encoding: "utf-8",
      }
    );

    expect(JSON.parse(stdout)).toEqual({ ok: true });
  });

  it("exports the request via `httap request export <format> <id>`", async () => {
    const { stdout, code } = await runCli(tempDir, ["request", "export", "curl", requestId]);

    expect(code).toBe(0);
    expect(stdout).toContain("curl");
    expect(stdout).toContain("https://api.example.com/users");
  });

  it("saves and unsaves via `httap request save|unsave <id>`", async () => {
    const saved = await runCli(tempDir, ["request", "save", requestId]);
    expect(saved.code).toBe(0);
    expect(storage.getRequest(requestId)?.saved).toBe(true);

    const unsaved = await runCli(tempDir, ["request", "unsave", requestId]);
    expect(unsaved.code).toBe(0);
    expect(storage.getRequest(requestId)?.saved ?? false).toBe(false);
  });

  it.each([
    [
      "id before the repeatable flags",
      ["request", "replay", "REQUEST_ID", "--set-header", "x-a:1"],
    ],
    ["id after the repeatable flags", ["request", "replay", "--set-header", "x-a:1", "REQUEST_ID"]],
  ])("resolves the replay id with %s", async (_label, template) => {
    const args = template.map((arg) => (arg === "REQUEST_ID" ? requestId : arg));

    const { stderr, code } = await runCli(tempDir, args);

    // This control server has no replay tracker, so reaching that error proves
    // commander resolved <id> rather than letting a flag swallow it.
    expect(code).toBe(1);
    expect(stderr).toContain("replay tracker not initialised");
    expect(stderr).not.toContain("missing required argument");
  });

  it("points at the new argument order for the old `request <id> body` form", async () => {
    const { stderr, code } = await runCli(tempDir, ["request", requestId, "body"]);

    expect(code).toBe(1);
    expect(stderr).toContain("httap request body <id>");
  });

  it("includes <format> in the hint for the old `request <id> export` form", async () => {
    const { stderr, code } = await runCli(tempDir, ["request", requestId, "export"]);

    expect(code).toBe(1);
    expect(stderr).toContain("httap request export <format> <id>");
  });

  it("accepts --set-header more than once", async () => {
    const { stderr } = await runCli(tempDir, [
      "request",
      "replay",
      "--set-header",
      "x-a:1",
      "--set-header",
      "x-b:2",
      requestId,
    ]);

    expect(stderr).toContain("replay tracker not initialised");
  });
});
