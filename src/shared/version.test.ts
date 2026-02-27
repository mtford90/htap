import { describe, it, expect } from "vitest";
import { getHttapVersion } from "./version.js";

describe("version", () => {
  describe("getHttapVersion", () => {
    it("returns a string", () => {
      const version = getHttapVersion();
      expect(typeof version).toBe("string");
    });

    it("returns semantic version format", () => {
      const version = getHttapVersion();
      // Should match semver pattern like "0.1.0" or "1.2.3-beta.1"
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });
});
