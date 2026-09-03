import { describe, expect, it } from "vitest";
import { matchesAnyKey, matchesKey, type KeyLike } from "./keys.js";

const key = (overrides: Partial<KeyLike> & { name: string }): KeyLike => ({
  sequence: overrides.name,
  ctrl: false,
  shift: false,
  meta: false,
  ...overrides,
});

describe("matchesKey", () => {
  it("matches a printable character by the character it produced", () => {
    expect(matchesKey(key({ name: "j", sequence: "j" }), "j")).toBe(true);
    expect(matchesKey(key({ name: "k", sequence: "k" }), "j")).toBe(false);
  });

  it("distinguishes an upper-case binding from its lower-case one", () => {
    const shifted = key({ name: "g", sequence: "G", shift: true });
    const plain = key({ name: "g", sequence: "g" });

    expect(matchesKey(shifted, "G")).toBe(true);
    expect(matchesKey(shifted, "g")).toBe(false);
    expect(matchesKey(plain, "g")).toBe(true);
    expect(matchesKey(plain, "G")).toBe(false);
  });

  it("matches named keys", () => {
    expect(matchesKey(key({ name: "down", sequence: "[B" }), "down")).toBe(true);
    expect(matchesKey(key({ name: "return", sequence: "\r" }), "return")).toBe(true);
    expect(matchesKey(key({ name: "space", sequence: " " }), "space")).toBe(true);
  });

  it("matches control combinations and rejects the bare key", () => {
    const ctrlD = key({ name: "d", sequence: "", ctrl: true });

    expect(matchesKey(ctrlD, "ctrl+d")).toBe(true);
    expect(matchesKey(ctrlD, "d")).toBe(false);
    expect(matchesKey(key({ name: "d", sequence: "d" }), "ctrl+d")).toBe(false);
  });

  it("separates Tab from Shift+Tab", () => {
    const tab = key({ name: "tab", sequence: "\t" });
    const shiftTab = key({ name: "tab", sequence: "[Z", shift: true });

    expect(matchesKey(tab, "tab")).toBe(true);
    expect(matchesKey(tab, "shift+tab")).toBe(false);
    expect(matchesKey(shiftTab, "shift+tab")).toBe(true);
    expect(matchesKey(shiftTab, "tab")).toBe(false);
  });

  it("never matches a meta-modified key", () => {
    expect(matchesKey(key({ name: "j", sequence: "j", meta: true }), "j")).toBe(false);
  });

  it("matches any specification in a list", () => {
    expect(matchesAnyKey(key({ name: "down", sequence: "[B" }), ["j", "down"])).toBe(true);
    expect(matchesAnyKey(key({ name: "x", sequence: "x" }), ["j", "down"])).toBe(false);
  });
});
