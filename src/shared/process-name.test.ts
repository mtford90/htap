import { describe, it, expect } from "vitest";
import { resolveProcessName } from "./process-name.js";

describe("resolveProcessName", () => {
  it("resolves the current process to a string", () => {
    const name = resolveProcessName(process.pid);
    expect(name).toBeDefined();
    expect(typeof name).toBe("string");
    if (name) {
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it("returns undefined for a non-existent PID", () => {
    const name = resolveProcessName(999999999);
    expect(name).toBeUndefined();
  });

  it("returns a basename without directory components", () => {
    const name = resolveProcessName(process.pid);
    expect(name).toBeDefined();
    if (name) {
      expect(name).not.toContain("/");
    }
  });
});
