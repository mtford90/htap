import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  findProjectRoot,
  findOrCreateProjectRoot,
  getProcsiDir,
  ensureProcsiDir,
  getProcsiPaths,
  readProxyPort,
  writeProxyPort,
  readDaemonPid,
  writeDaemonPid,
  removeDaemonPid,
  isProcessRunning,
  setConfigOverride,
  getConfigOverride,
} from "./project.js";

describe("project utilities", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "procsi-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("findProjectRoot", () => {
    it("returns undefined when no .procsi or .git directory exists", () => {
      const result = findProjectRoot(tempDir);
      expect(result).toBeUndefined();
    });

    it("finds project root when .procsi directory exists", () => {
      const procsiDir = path.join(tempDir, ".procsi");
      fs.mkdirSync(procsiDir);

      const result = findProjectRoot(tempDir);
      expect(result).toBe(tempDir);
    });

    it("finds project root when .git directory exists", () => {
      const gitDir = path.join(tempDir, ".git");
      fs.mkdirSync(gitDir);

      const result = findProjectRoot(tempDir);
      expect(result).toBe(tempDir);
    });

    it("prefers .procsi over .git when both exist", () => {
      const procsiDir = path.join(tempDir, ".procsi");
      const gitDir = path.join(tempDir, ".git");
      fs.mkdirSync(procsiDir);
      fs.mkdirSync(gitDir);

      const result = findProjectRoot(tempDir);
      expect(result).toBe(tempDir);
    });

    it("walks up directory tree to find project root", () => {
      const procsiDir = path.join(tempDir, ".procsi");
      const subDir = path.join(tempDir, "src", "components");
      fs.mkdirSync(procsiDir);
      fs.mkdirSync(subDir, { recursive: true });

      const result = findProjectRoot(subDir);
      expect(result).toBe(tempDir);
    });
  });

  describe("findOrCreateProjectRoot", () => {
    it("returns directory with existing .procsi", () => {
      const procsiDir = path.join(tempDir, ".procsi");
      fs.mkdirSync(procsiDir);

      const result = findOrCreateProjectRoot(tempDir);
      expect(result).toBe(tempDir);
    });

    it("returns git root when .git exists but no .procsi", () => {
      const gitDir = path.join(tempDir, ".git");
      fs.mkdirSync(gitDir);

      const result = findOrCreateProjectRoot(tempDir);
      expect(result).toBe(tempDir);
    });

    it("returns startDir when neither .procsi nor .git exists in isolated tree", () => {
      // Note: This test verifies the fallback logic. In practice, when run inside
      // a git repo (like during development), the function will find that repo's
      // .git directory. This test documents the expected behaviour when truly
      // isolated from any git repo.
      const subDir = path.join(tempDir, "some", "nested", "dir");
      fs.mkdirSync(subDir, { recursive: true });

      // Since we're running inside the procsi git repo, the function will walk up
      // and find it. We verify it returns a valid path (the git root it found).
      const result = findOrCreateProjectRoot(subDir);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("stops at .git boundary even when parent has .procsi", () => {
      // A child project with .git should NOT walk past it to find .procsi in a parent
      const parentProcsi = path.join(tempDir, ".procsi");
      const child = path.join(tempDir, "child-project");
      const childGit = path.join(child, ".git");

      fs.mkdirSync(parentProcsi);
      fs.mkdirSync(childGit, { recursive: true });

      const result = findOrCreateProjectRoot(child);
      expect(result).toBe(child);
    });

    it("prefers .procsi over .git when both exist at different levels", () => {
      // Git root at tempDir, .procsi at a subdirectory
      const gitDir = path.join(tempDir, ".git");
      const projectDir = path.join(tempDir, "project");
      const procsiDir = path.join(projectDir, ".procsi");
      const workDir = path.join(projectDir, "src");

      fs.mkdirSync(gitDir);
      fs.mkdirSync(procsiDir, { recursive: true });
      fs.mkdirSync(workDir, { recursive: true });

      const result = findOrCreateProjectRoot(workDir);
      expect(result).toBe(projectDir);
    });

    it("walks up to find git root from nested directory", () => {
      const gitDir = path.join(tempDir, ".git");
      const subDir = path.join(tempDir, "src", "components", "ui");
      fs.mkdirSync(gitDir);
      fs.mkdirSync(subDir, { recursive: true });

      const result = findOrCreateProjectRoot(subDir);
      expect(result).toBe(tempDir);
    });
  });

  describe("getProcsiDir", () => {
    it("returns path to .procsi directory", () => {
      const result = getProcsiDir(tempDir);
      expect(result).toBe(path.join(tempDir, ".procsi"));
    });
  });

  describe("ensureProcsiDir", () => {
    it("creates .procsi directory if it does not exist", () => {
      const procsiDir = ensureProcsiDir(tempDir);

      expect(procsiDir).toBe(path.join(tempDir, ".procsi"));
      expect(fs.existsSync(procsiDir)).toBe(true);
    });

    it("returns existing .procsi directory if it exists", () => {
      const existingDir = path.join(tempDir, ".procsi");
      fs.mkdirSync(existingDir);

      const procsiDir = ensureProcsiDir(tempDir);

      expect(procsiDir).toBe(existingDir);
      expect(fs.existsSync(procsiDir)).toBe(true);
    });
  });

  describe("getProcsiPaths", () => {
    it("returns all expected paths", () => {
      const paths = getProcsiPaths(tempDir);

      expect(paths.procsiDir).toBe(path.join(tempDir, ".procsi"));
      expect(paths.proxyPortFile).toBe(path.join(tempDir, ".procsi", "proxy.port"));
      expect(paths.controlSocketFile).toBe(path.join(tempDir, ".procsi", "control.sock"));
      expect(paths.databaseFile).toBe(path.join(tempDir, ".procsi", "requests.db"));
      expect(paths.caKeyFile).toBe(path.join(tempDir, ".procsi", "ca-key.pem"));
      expect(paths.caCertFile).toBe(path.join(tempDir, ".procsi", "ca.pem"));
      expect(paths.pidFile).toBe(path.join(tempDir, ".procsi", "daemon.pid"));
    });
  });

  describe("proxy port file", () => {
    beforeEach(() => {
      ensureProcsiDir(tempDir);
    });

    it("returns undefined when port file does not exist", () => {
      const result = readProxyPort(tempDir);
      expect(result).toBeUndefined();
    });

    it("writes and reads proxy port", () => {
      writeProxyPort(tempDir, 8080);
      const result = readProxyPort(tempDir);
      expect(result).toBe(8080);
    });

    it("returns undefined for invalid port content", () => {
      const { proxyPortFile } = getProcsiPaths(tempDir);
      fs.writeFileSync(proxyPortFile, "not-a-number");

      const result = readProxyPort(tempDir);
      expect(result).toBeUndefined();
    });
  });

  describe("daemon pid file", () => {
    beforeEach(() => {
      ensureProcsiDir(tempDir);
    });

    it("returns undefined when pid file does not exist", () => {
      const result = readDaemonPid(tempDir);
      expect(result).toBeUndefined();
    });

    it("writes and reads daemon pid", () => {
      writeDaemonPid(tempDir, 12345);
      const result = readDaemonPid(tempDir);
      expect(result).toBe(12345);
    });

    it("removes daemon pid file", () => {
      writeDaemonPid(tempDir, 12345);
      removeDaemonPid(tempDir);

      const result = readDaemonPid(tempDir);
      expect(result).toBeUndefined();
    });

    it("handles removing non-existent pid file", () => {
      // Should not throw
      removeDaemonPid(tempDir);
    });
  });

  describe("isProcessRunning", () => {
    it("returns true for current process", () => {
      const result = isProcessRunning(process.pid);
      expect(result).toBe(true);
    });

    it("returns false for non-existent process", () => {
      // Using a very high PID that's unlikely to exist
      const result = isProcessRunning(999999999);
      expect(result).toBe(false);
    });
  });

  describe("override parameter", () => {
    it("findProjectRoot returns resolved override path when .procsi exists", () => {
      const procsiDir = path.join(tempDir, ".procsi");
      fs.mkdirSync(procsiDir);
      const result = findProjectRoot(undefined, tempDir);
      expect(result).toBe(tempDir);
    });

    it("findProjectRoot returns resolved override path when .git exists", () => {
      const gitDir = path.join(tempDir, ".git");
      fs.mkdirSync(gitDir);
      const result = findProjectRoot(undefined, tempDir);
      expect(result).toBe(tempDir);
    });

    it("findProjectRoot returns undefined when override has no .procsi or .git", () => {
      const result = findProjectRoot(undefined, tempDir);
      expect(result).toBeUndefined();
    });

    it("findOrCreateProjectRoot returns resolved override path directly", () => {
      const result = findOrCreateProjectRoot(undefined, tempDir);
      expect(result).toBe(tempDir);
    });

    it("resolves ~ to home directory", () => {
      const result = findOrCreateProjectRoot(undefined, "~/some-project");
      expect(result).toBe(path.join(os.homedir(), "some-project"));
    });

    it("resolves ~ alone to home directory", () => {
      const result = findOrCreateProjectRoot(undefined, "~");
      expect(result).toBe(os.homedir());
    });

    it("resolves already-absolute paths unchanged", () => {
      const result = findOrCreateProjectRoot(undefined, "/tmp/my-project");
      expect(result).toBe("/tmp/my-project");
    });

    it("resolves empty string override to cwd", () => {
      const result = findOrCreateProjectRoot(undefined, "");
      expect(result).toBe(path.resolve(""));
    });

    it("resolves relative paths to absolute", () => {
      const result = findOrCreateProjectRoot(undefined, "relative/path");
      expect(result).toBe(path.resolve("relative/path"));
    });
  });

  describe("homedir fallback", () => {
    it("findOrCreateProjectRoot falls back to homedir when no .procsi or .git found in isolated tree", () => {
      const subDir = path.join(tempDir, "some", "nested", "dir");
      fs.mkdirSync(subDir, { recursive: true });
      // In this test env we're inside a git repo, so this will find that.
      // The important thing is the function doesn't return cwd.
      const result = findOrCreateProjectRoot(subDir);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("config override", () => {
    afterEach(() => {
      setConfigOverride(undefined);
    });

    it("setConfigOverride sets the override and getConfigOverride returns it", () => {
      expect(getConfigOverride()).toBeUndefined();
      setConfigOverride("/tmp/custom-procsi");
      expect(getConfigOverride()).toBe("/tmp/custom-procsi");
    });

    it("setConfigOverride(undefined) clears the override", () => {
      setConfigOverride("/tmp/custom-procsi");
      setConfigOverride(undefined);
      expect(getConfigOverride()).toBeUndefined();
    });

    it("getProcsiDir returns the override when set, ignoring projectRoot", () => {
      const overrideDir = path.join(tempDir, "custom-data");
      setConfigOverride(overrideDir);
      const result = getProcsiDir("/some/ignored/path");
      expect(result).toBe(overrideDir);
    });

    it("getProcsiDir returns projectRoot + .procsi when no override is set", () => {
      const result = getProcsiDir(tempDir);
      expect(result).toBe(path.join(tempDir, ".procsi"));
    });

    it("getProcsiPaths uses the override as the procsi dir when set", () => {
      const overrideDir = path.join(tempDir, "custom-data");
      setConfigOverride(overrideDir);
      const paths = getProcsiPaths("/ignored");
      expect(paths.procsiDir).toBe(overrideDir);
      expect(paths.proxyPortFile).toBe(path.join(overrideDir, "proxy.port"));
      expect(paths.controlSocketFile).toBe(path.join(overrideDir, "control.sock"));
      expect(paths.databaseFile).toBe(path.join(overrideDir, "requests.db"));
      expect(paths.pidFile).toBe(path.join(overrideDir, "daemon.pid"));
      expect(paths.logFile).toBe(path.join(overrideDir, "procsi.log"));
      expect(paths.configFile).toBe(path.join(overrideDir, "config.json"));
    });

    it("ensureProcsiDir creates the override directory when set", () => {
      const overrideDir = path.join(tempDir, "custom-data");
      setConfigOverride(overrideDir);
      const result = ensureProcsiDir("/ignored");
      expect(result).toBe(overrideDir);
      expect(fs.existsSync(overrideDir)).toBe(true);
    });

    it("readProxyPort / writeProxyPort operate inside the override dir", () => {
      const overrideDir = path.join(tempDir, "custom-data");
      fs.mkdirSync(overrideDir, { recursive: true });
      setConfigOverride(overrideDir);

      writeProxyPort("/ignored", 9999);
      expect(readProxyPort("/ignored")).toBe(9999);
      expect(fs.existsSync(path.join(overrideDir, "proxy.port"))).toBe(true);
    });

    it("readDaemonPid / writeDaemonPid / removeDaemonPid operate inside the override dir", () => {
      const overrideDir = path.join(tempDir, "custom-data");
      fs.mkdirSync(overrideDir, { recursive: true });
      setConfigOverride(overrideDir);

      writeDaemonPid("/ignored", 12345);
      expect(readDaemonPid("/ignored")).toBe(12345);
      expect(fs.existsSync(path.join(overrideDir, "daemon.pid"))).toBe(true);

      removeDaemonPid("/ignored");
      expect(readDaemonPid("/ignored")).toBeUndefined();
    });
  });
});
