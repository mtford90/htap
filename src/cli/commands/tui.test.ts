import { describe, expect, it } from "vitest";
import { supportsFfiFlag } from "./tui.js";

describe("supportsFfiFlag", () => {
  it("accepts the first release that carries node:ffi", () => {
    expect(supportsFfiFlag("v26.4.0")).toBe(true);
  });

  it("accepts later 26.x and every later major", () => {
    expect(supportsFfiFlag("v26.8.1")).toBe(true);
    expect(supportsFfiFlag("v27.0.0")).toBe(true);
  });

  it("rejects earlier releases", () => {
    expect(supportsFfiFlag("v26.3.0")).toBe(false);
    expect(supportsFfiFlag("v24.20.0")).toBe(false);
  });

  it("reads a version without the leading v", () => {
    expect(supportsFfiFlag("26.4.0")).toBe(true);
  });
});
