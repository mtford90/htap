import { describe, it, expect } from "vitest";
import { getHtapVersion } from "./version.js";

describe("version", () => {
  describe("getHtapVersion", () => {
    it("returns a string", () => {
      const version = getHtapVersion();
      expect(typeof version).toBe("string");
    });

    it("returns semantic version format", () => {
      const version = getHtapVersion();
      // Should match semver pattern like "0.1.0" or "1.2.3-beta.1"
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });
});
