import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";

// Mock child_process
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "node:child_process";
import { copyToClipboard } from "./clipboard.js";

const mockSpawn = vi.mocked(spawn);

interface MockProcess extends EventEmitter {
  stdin: {
    write: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
}

function createMockProcess(): MockProcess {
  const proc = new EventEmitter() as MockProcess;
  proc.stdin = { write: vi.fn(), end: vi.fn() };
  return proc;
}

describe("copyToClipboard", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original platform
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
  });

  describe("macOS (darwin)", () => {
    beforeEach(() => {
      Object.defineProperty(process, "platform", {
        value: "darwin",
        configurable: true,
      });
    });

    it("spawns pbcopy with empty args", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const promise = copyToClipboard("test text");

      // Simulate successful close
      process.nextTick(() => proc.emit("close", 0));

      await expect(promise).resolves.toBeUndefined();
      expect(mockSpawn).toHaveBeenCalledWith(
        "pbcopy",
        [],
        expect.objectContaining({ stdio: ["pipe", "ignore", "ignore"] })
      );
    });

    it("writes text to stdin and ends", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const promise = copyToClipboard("hello world");

      process.nextTick(() => proc.emit("close", 0));

      await promise;

      expect(proc.stdin.write).toHaveBeenCalledWith("hello world");
      expect(proc.stdin.end).toHaveBeenCalled();
    });

    it("resolves on close with code 0", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const promise = copyToClipboard("success");

      process.nextTick(() => proc.emit("close", 0));

      await expect(promise).resolves.toBeUndefined();
    });

    it("rejects on close with non-zero code", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const promise = copyToClipboard("failure");

      process.nextTick(() => proc.emit("close", 1));

      await expect(promise).rejects.toThrow("pbcopy exited with code 1");
    });

    it("rejects on error event", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const promise = copyToClipboard("error test");

      const error = new Error("spawn failed");
      process.nextTick(() => proc.emit("error", error));

      await expect(promise).rejects.toThrow("spawn failed");
    });
  });

  describe("Windows (win32)", () => {
    beforeEach(() => {
      Object.defineProperty(process, "platform", {
        value: "win32",
        configurable: true,
      });
    });

    it("spawns clip with empty args", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const promise = copyToClipboard("windows test");

      process.nextTick(() => proc.emit("close", 0));

      await expect(promise).resolves.toBeUndefined();
      expect(mockSpawn).toHaveBeenCalledWith(
        "clip",
        [],
        expect.objectContaining({ stdio: ["pipe", "ignore", "ignore"] })
      );
    });

    it("writes text to stdin and ends", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const promise = copyToClipboard("clip test");

      process.nextTick(() => proc.emit("close", 0));

      await promise;

      expect(proc.stdin.write).toHaveBeenCalledWith("clip test");
      expect(proc.stdin.end).toHaveBeenCalled();
    });

    it("rejects on close with non-zero code", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const promise = copyToClipboard("failure");

      process.nextTick(() => proc.emit("close", 2));

      await expect(promise).rejects.toThrow("clip exited with code 2");
    });
  });

  describe("Linux", () => {
    beforeEach(() => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        configurable: true,
      });
    });

    it("spawns xclip with correct args", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const promise = copyToClipboard("linux test");

      process.nextTick(() => proc.emit("close", 0));

      await expect(promise).resolves.toBeUndefined();
      expect(mockSpawn).toHaveBeenCalledWith(
        "xclip",
        ["-selection", "clipboard"],
        expect.objectContaining({ stdio: ["pipe", "ignore", "ignore"] })
      );
    });

    it("writes text to stdin and ends", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      const promise = copyToClipboard("xclip test");

      process.nextTick(() => proc.emit("close", 0));

      await promise;

      expect(proc.stdin.write).toHaveBeenCalledWith("xclip test");
      expect(proc.stdin.end).toHaveBeenCalled();
    });

    it("falls back to xsel on xclip error", async () => {
      const xclipProc = createMockProcess();
      const xselProc = createMockProcess();

      let callCount = 0;
      mockSpawn.mockImplementation((cmd) => {
        callCount++;
        if (callCount === 1 && cmd === "xclip") {
          return xclipProc as unknown as ChildProcess;
        } else if (callCount === 2 && cmd === "xsel") {
          return xselProc as unknown as ChildProcess;
        }
        throw new Error("Unexpected spawn call");
      });

      const promise = copyToClipboard("fallback test");

      // Simulate xclip error, which triggers xsel fallback
      process.nextTick(() => {
        xclipProc.emit("error", new Error("xclip not found"));
        // Then xsel succeeds
        process.nextTick(() => xselProc.emit("close", 0));
      });

      await expect(promise).resolves.toBeUndefined();

      expect(mockSpawn).toHaveBeenCalledWith(
        "xclip",
        ["-selection", "clipboard"],
        expect.objectContaining({ stdio: ["pipe", "ignore", "ignore"] })
      );
      expect(mockSpawn).toHaveBeenCalledWith(
        "xsel",
        ["--clipboard", "--input"],
        expect.objectContaining({ stdio: ["pipe", "ignore", "ignore"] })
      );
      expect(xselProc.stdin.write).toHaveBeenCalledWith("fallback test");
      expect(xselProc.stdin.end).toHaveBeenCalled();
    });

    it("xsel fallback succeeds", async () => {
      const xclipProc = createMockProcess();
      const xselProc = createMockProcess();

      let callCount = 0;
      mockSpawn.mockImplementation((cmd) => {
        callCount++;
        if (callCount === 1 && cmd === "xclip") {
          return xclipProc as unknown as ChildProcess;
        } else if (callCount === 2 && cmd === "xsel") {
          return xselProc as unknown as ChildProcess;
        }
        throw new Error("Unexpected spawn call");
      });

      const promise = copyToClipboard("xsel success");

      process.nextTick(() => {
        xclipProc.emit("error", new Error("xclip failed"));
        process.nextTick(() => xselProc.emit("close", 0));
      });

      await expect(promise).resolves.toBeUndefined();
    });

    it("rejects when both xclip and xsel fail", async () => {
      const xclipProc = createMockProcess();
      const xselProc = createMockProcess();

      let callCount = 0;
      mockSpawn.mockImplementation((cmd) => {
        callCount++;
        if (callCount === 1 && cmd === "xclip") {
          return xclipProc as unknown as ChildProcess;
        } else if (callCount === 2 && cmd === "xsel") {
          return xselProc as unknown as ChildProcess;
        }
        throw new Error("Unexpected spawn call");
      });

      const promise = copyToClipboard("both fail");

      process.nextTick(() => {
        xclipProc.emit("error", new Error("xclip not found"));
        process.nextTick(() => xselProc.emit("error", new Error("xsel not found")));
      });

      await expect(promise).rejects.toThrow("No clipboard tool available (tried xclip and xsel)");
    });

    it("rejects when xsel fallback exits with non-zero code", async () => {
      const xclipProc = createMockProcess();
      const xselProc = createMockProcess();

      let callCount = 0;
      mockSpawn.mockImplementation((cmd) => {
        callCount++;
        if (callCount === 1 && cmd === "xclip") {
          return xclipProc as unknown as ChildProcess;
        } else if (callCount === 2 && cmd === "xsel") {
          return xselProc as unknown as ChildProcess;
        }
        throw new Error("Unexpected spawn call");
      });

      const promise = copyToClipboard("xsel fails with code");

      process.nextTick(() => {
        xclipProc.emit("error", new Error("xclip error"));
        process.nextTick(() => xselProc.emit("close", 1));
      });

      await expect(promise).rejects.toThrow("xsel exited with code 1");
    });
  });
});
