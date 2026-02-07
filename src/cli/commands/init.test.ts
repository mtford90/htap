import { describe, it, expect } from "vitest";
import { generateShellFunction } from "./init.js";

describe("generateShellFunction", () => {
  it("generates valid shell function syntax", () => {
    const output = generateShellFunction();

    // Should define a function named htpx
    expect(output).toContain("htpx()");

    // Should check for intercept command
    expect(output).toContain('if [[ "$1" == "intercept" ]]');

    // Should use eval for intercept
    expect(output).toContain("eval");

    // Should pass through other commands
    expect(output).toContain('command htpx "$@"');

    // Should be properly structured
    expect(output).toContain("{");
    expect(output).toContain("}");
  });

  it("uses shift before calling intercept", () => {
    const output = generateShellFunction();

    // shift should come before the eval
    const shiftIndex = output.indexOf("shift");
    const evalIndex = output.indexOf("eval");

    expect(shiftIndex).toBeGreaterThan(-1);
    expect(evalIndex).toBeGreaterThan(-1);
    expect(shiftIndex).toBeLessThan(evalIndex);
  });
});
