/**
 * End-to-end tests for the installed `httap` binary (`bin/httap`), the shell
 * wrapper that checks the Node version before exec'ing the CLI with the FFI
 * flags. The Node check is driven with a fake `node` on PATH so the message
 * older runtimes see is exercised without installing one.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getHttapVersion } from "../../src/shared/version.js";

const binPath = path.resolve(process.cwd(), "bin/httap");

const runBin = (args: string[], env: NodeJS.ProcessEnv = process.env) =>
  spawnSync(binPath, args, { env, encoding: "utf8" });

describe("bin/httap", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "httap-bin-")));
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("runs the CLI on the current Node", () => {
    const result = runBin(["--version"]);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(getHttapVersion());
  });

  it("resolves the CLI through a symlink, as npm installs it", () => {
    const linkDir = path.join(tempDir, "link-bin");
    fs.mkdirSync(linkDir);
    const link = path.join(linkDir, "httap");
    fs.symlinkSync(path.relative(linkDir, binPath), link);

    const result = spawnSync(link, ["--version"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(getHttapVersion());
  });

  it("explains the Node floor on an older runtime for any command", () => {
    const fakeBin = path.join(tempDir, "old-node");
    fs.mkdirSync(fakeBin);
    fs.writeFileSync(path.join(fakeBin, "node"), "#!/bin/sh\necho v24.18.0\n", { mode: 0o755 });

    const env = { ...process.env, PATH: `${fakeBin}:${process.env["PATH"] ?? ""}` };
    const result = runBin(["status"], env);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("httap needs Node 26.4+ (you have v24.18.0).");
    expect(result.stdout).toBe("");
  });

  it("explains when no node is on PATH", () => {
    const result = runBin(["--version"], { ...process.env, PATH: tempDir });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("httap needs Node 26.4+");
  });
});
